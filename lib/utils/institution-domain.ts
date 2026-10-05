// =============================================================================
// lib/utils/institution-domain.ts
//
// Server-only: match a student's email against the email_domains of active
// Hungarian institutions. Exact domain or a true subdomain ("x.elte.hu" for
// "elte.hu") — never a substring match.
// =============================================================================

export interface MatchedInstitution {
  id: string;
  name: string;
}

export function emailDomainMatches(domain: string, allowed: string): boolean {
  const d = domain.toLowerCase();
  const a = allowed.toLowerCase().replace(/^@/, '');
  return d === a || d.endsWith('.' + a);
}

export async function findInstitutionForEmail(admin: any, email: string): Promise<MatchedInstitution | null> {
  const domain = email.trim().toLowerCase().split('@')[1];
  if (!domain) return null;

  const { data: institutions } = await admin
    .from('institutions')
    .select('id, name, email_domains')
    .eq('is_active', true)
    .eq('country', 'Hungary');

  const match = ((institutions ?? []) as { id: string; name: string; email_domains: string[] | null }[]).find(
    (inst) => Array.isArray(inst.email_domains) && inst.email_domains.some((d) => emailDomainMatches(domain, d))
  );
  return match ? { id: match.id, name: match.name } : null;
}
