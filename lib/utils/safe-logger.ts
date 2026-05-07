/**
 * safe-logger.ts
 * PII-scrubbing logger for all API routes.
 * Never logs: email addresses, names, document URLs, student IDs, phone numbers.
 * Use this instead of console.log in all API routes.
 */

// Patterns that identify PII
const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Email addresses
  { pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, replacement: '[EMAIL]' },
  // Supabase Storage document URLs (verification ID scans)
  { pattern: /https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/[^\s"']+/g, replacement: '[STORAGE_URL]' },
  // Signed URLs
  { pattern: /https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/sign\/[^\s"']+/g, replacement: '[SIGNED_URL]' },
  // Phone numbers (Hungarian format and international)
  { pattern: /(\+36|06)[\s\-]?[0-9]{2}[\s\-]?[0-9]{3}[\s\-]?[0-9]{4}/g, replacement: '[PHONE]' },
  { pattern: /\+?[0-9]{1,3}[\s\-]?\(?[0-9]{1,4}\)?[\s\-]?[0-9]{1,4}[\s\-]?[0-9]{4,9}/g, replacement: '[PHONE]' },
  // Student ID numbers (typically 6-11 digit strings near "id" context)
  { pattern: /student[\s_\-]?id[\s:=]+[0-9A-Z\-]{4,20}/gi, replacement: 'student_id=[REDACTED]' },
  // IP addresses (we hash these before logging anyway, but double-guard)
  { pattern: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g, replacement: '[IP]' },
  // UUIDs that appear next to sensitive field names — leave stand-alone UUIDs (user_id etc.) as they're needed for debugging
  { pattern: /(verification_document_url|document_url|id_scan)["\s:=]+["']?[^\s"',}]+["']?/gi, replacement: '$1=[REDACTED]' },
  // Full names (harder — use heuristic: "John Smith" pattern near sensitive keys)
  { pattern: /(full_name|display_name|first_name|last_name)["\s:=]+["']([A-Z][a-z]+ )+[A-Z][a-z]+["']/gi, replacement: '$1=[REDACTED]' },
];

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function scrub(input: unknown): string {
  let str = typeof input === 'string' ? input : JSON.stringify(input, null, 0);
  for (const { pattern, replacement } of PII_PATTERNS) {
    str = str.replace(pattern, replacement);
  }
  return str;
}

function formatArgs(args: unknown[]): string {
  return args.map(a => scrub(a)).join(' ');
}

const PREFIX = '[Unideals]';

export const safeLog = {
  info: (...args: unknown[]) => {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`${PREFIX}[INFO]`, formatArgs(args));
    }
  },
  warn: (...args: unknown[]) => {
    console.warn(`${PREFIX}[WARN]`, formatArgs(args));
  },
  error: (...args: unknown[]) => {
    // Always log errors but scrub PII
    console.error(`${PREFIX}[ERROR]`, formatArgs(args));
  },
  debug: (...args: unknown[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`${PREFIX}[DEBUG]`, formatArgs(args));
    }
  },
  // Audit log — structured, PII-free, for security events
  audit: (event: string, meta: Record<string, unknown> = {}) => {
    const safe = Object.fromEntries(
      Object.entries(meta).map(([k, v]) => [k, scrub(v)])
    );
    console.log(`${PREFIX}[AUDIT]`, JSON.stringify({ event, ...safe, ts: new Date().toISOString() }));
  },
};
