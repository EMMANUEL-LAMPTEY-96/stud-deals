// =============================================================================
// lib/utils/reward-claim.ts
//
// Marks a loyalty reward (redemptions row with status reward_earned /
// tier_reward) as handed over to the student.
//
// The status is deliberately NOT changed: stamp counts are computed from
// status IN ('stamp','reward_earned','tier_reward'), and flipping to
// 'confirmed' both dropped a stamp from the student's count and fired the
// voucher-confirmation trigger. The hand-over is recorded in metadata instead.
// =============================================================================

export const REWARD_STATUSES = ['reward_earned', 'tier_reward'] as const;

export type RewardClaimResult =
  | { ok: true; claimed_at: string }
  | { ok: false; status: number; error: string };

export async function markRewardHandedOver(
  admin: any,
  vendorId: string,
  redemptionId: string,
  claimedBy: { user_id?: string; staff_id?: string }
): Promise<RewardClaimResult> {
  const { data: row } = await admin
    .from('redemptions')
    .select('id, metadata')
    .eq('id', redemptionId)
    .eq('vendor_id', vendorId)
    .in('status', REWARD_STATUSES as unknown as string[])
    .maybeSingle();

  if (!row) return { ok: false, status: 404, error: 'Reward not found.' };
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  if (metadata.reward_claimed_at) return { ok: false, status: 409, error: 'Reward already claimed.' };

  const claimed_at = new Date().toISOString();
  const { data: updated, error } = await admin
    .from('redemptions')
    .update({ metadata: { ...metadata, reward_claimed_at: claimed_at, reward_claimed_by: claimedBy } })
    .eq('id', redemptionId)
    .eq('vendor_id', vendorId)
    .is('metadata->reward_claimed_at', null)
    .select('id');

  if (error) return { ok: false, status: 500, error: 'Could not claim reward.' };
  if (!updated?.length) return { ok: false, status: 409, error: 'Reward already claimed.' };
  return { ok: true, claimed_at };
}
