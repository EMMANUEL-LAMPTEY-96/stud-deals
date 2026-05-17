#!/usr/bin/env bash
# =============================================================================
# scripts/regen-types.sh
#
# Regenerates Supabase TypeScript types and removes all @ts-nocheck pragmas.
#
# Prerequisites:
#   export SUPABASE_ACCESS_TOKEN=your_personal_access_token
#   (Get it from: https://supabase.com/dashboard/account/tokens)
#
# Usage:
#   chmod +x scripts/regen-types.sh
#   SUPABASE_ACCESS_TOKEN=sbp_xxx ./scripts/regen-types.sh
# =============================================================================

set -e

if [ -z "$SUPABASE_ACCESS_TOKEN" ]; then
  echo "❌  SUPABASE_ACCESS_TOKEN is not set."
  echo "    Get yours from: https://supabase.com/dashboard/account/tokens"
  echo "    Then run: SUPABASE_ACCESS_TOKEN=sbp_xxx ./scripts/regen-types.sh"
  exit 1
fi

PROJECT_ID="mktqusaucpunasdnfulx"
TYPES_FILE="lib/types/database.types.ts"

echo "🔄  Regenerating Supabase types for project $PROJECT_ID..."
npx supabase gen types typescript \
  --project-id "$PROJECT_ID" \
  --schema public \
  > "$TYPES_FILE"

echo "✅  Types written to $TYPES_FILE"

# Count @ts-nocheck pragmas before removal
NOCHECK_COUNT=$(grep -rl "@ts-nocheck" --include="*.ts" --include="*.tsx" . \
  | grep -v node_modules \
  | grep -v ".next" \
  | wc -l | tr -d ' ')

echo "🧹  Removing @ts-nocheck from $NOCHECK_COUNT files..."

# Remove @ts-nocheck lines (both the pragma and the explanatory comment below it)
find . -type f \( -name "*.ts" -o -name "*.tsx" \) \
  ! -path "./node_modules/*" \
  ! -path "./.next/*" \
  ! -path "./scripts/*" \
  -exec sed -i \
    -e '/^\/\/ @ts-nocheck$/d' \
    -e '/^\/\/ Pre-existing Supabase typed-client debt — suppressed until db types are regenerated\.$/d' \
    {} +

echo "✅  @ts-nocheck pragmas removed"
echo ""
echo "🔨  Running TypeScript check..."
npx tsc --noEmit 2>&1 | head -50 || true

echo ""
echo "Done. Fix any TypeScript errors above, then commit."
