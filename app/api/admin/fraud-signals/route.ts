// @ts-nocheck
// =============================================================================
// GET /api/admin/fraud-signals
//
// Returns three loyalty fraud/health signals:
//   1. rate_limit_hits   — students who hit the stamp rate limit in the last 24h
//                          (proxy: ≥5 stamps at same vendor in 24h from same student)
//   2. at_risk_vendors   — approved vendors with 0 redemptions in the last 30 days
//   3. velocity_spikes   — student-vendor pairs with ≥10 stamps in any 1-hour window
//                          in the last 7 days
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: callerProfile } = await admin
    .from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (callerProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const now = new Date();
  const h24ago  = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const d7ago   = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000).toISOString();
  const d30ago  = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // ── 1. Rate-limit proxy: ≥5 stamps at same vendor in 24h ─────────────────
  const { data: recentStamps } = await admin
    .from('redemptions')
    .select('student_id, vendor_id, created_at')
    .in('status', ['stamp', 'reward_earned', 'tier_reward'])
    .gte('created_at', h24ago);

  const stampKey = (s: string, v: string) => `${s}|${v}`;
  const pairCount: Record<string, number> = {};
  for (const r of recentStamps ?? []) {
    const k = stampKey(r.student_id, r.vendor_id);
    pairCount[k] = (pairCount[k] ?? 0) + 1;
  }
  const suspiciousPairs = Object.entries(pairCount)
    .filter(([, c]) => c >= 5)
    .map(([k, c]) => ({ student_id: k.split('|')[0], vendor_id: k.split('|')[1], stamp_count: c }))
    .sort((a, b) => b.stamp_count - a.stamp_count)
    .slice(0, 20);

  // Enrich with names
  const spStudentIds = [...new Set(suspiciousPairs.map((p) => p.student_id))];
  const spVendorIds  = [...new Set(suspiciousPairs.map((p) => p.vendor_id))];
  const [{ data: spStudents }, { data: spVendors }] = await Promise.all([
    spStudentIds.length ? admin.from('profiles').select('id, first_name, last_name, display_name').in('id', spStudentIds) : Promise.resolve({ data: [] }),
    spVendorIds.length  ? admin.from('vendor_profiles').select('id, business_name').in('id', spVendorIds) : Promise.resolve({ data: [] }),
  ]);
  const spStudentMap: Record<string, string> = {};
  for (const s of spStudents ?? []) spStudentMap[s.id] = s.first_name ? `${s.first_name} ${s.last_name ?? ''}`.trim() : (s.display_name ?? 'Student');
  const spVendorMap:  Record<string, string> = {};
  for (const v of spVendors  ?? []) spVendorMap[v.id]  = v.business_name;

  const rateLimitHits = suspiciousPairs.map((p) => ({
    ...p,
    student_name: spStudentMap[p.student_id] ?? 'Unknown',
    vendor_name:  spVendorMap[p.vendor_id]   ?? 'Unknown',
  }));

  // ── 2. At-risk vendors: approved, 0 redemptions in 30 days ───────────────
  const { data: approvedVendors } = await admin
    .from('vendor_profiles')
    .select('id, business_name, city, created_at')
    .eq('is_verified', true);

  const { data: activeVendorRows } = await admin
    .from('redemptions')
    .select('vendor_id')
    .gte('created_at', d30ago);

  const activeVendorSet = new Set((activeVendorRows ?? []).map((r) => r.vendor_id));

  const atRiskVendors = (approvedVendors ?? [])
    .filter((v) => !activeVendorSet.has(v.id))
    .map((v) => ({
      id:            v.id,
      business_name: v.business_name,
      city:          v.city,
      days_since_join: Math.floor((now.getTime() - new Date(v.created_at).getTime()) / 86400000),
    }))
    .sort((a, b) => b.days_since_join - a.days_since_join)
    .slice(0, 10);

  // ── 3. Velocity spikes: ≥10 stamps in any 1-hour window (7 days) ─────────
  const { data: weekStamps } = await admin
    .from('redemptions')
    .select('student_id, vendor_id, created_at')
    .in('status', ['stamp', 'reward_earned', 'tier_reward'])
    .gte('created_at', d7ago)
    .order('created_at', { ascending: true });

  // Group by student+vendor, then slide a 1-hour window
  const byPair: Record<string, string[]> = {};
  for (const r of weekStamps ?? []) {
    const k = stampKey(r.student_id, r.vendor_id);
    if (!byPair[k]) byPair[k] = [];
    byPair[k].push(r.created_at);
  }

  const velocitySpikes: { student_id: string; vendor_id: string; student_name: string; vendor_name: string; max_in_hour: number }[] = [];
  const seenPairs = new Set<string>();

  for (const [k, times] of Object.entries(byPair)) {
    let maxInHour = 0;
    for (let i = 0; i < times.length; i++) {
      const windowStart = new Date(times[i]).getTime();
      const windowEnd   = windowStart + 60 * 60 * 1000;
      let count = 0;
      for (let j = i; j < times.length; j++) {
        if (new Date(times[j]).getTime() <= windowEnd) count++;
        else break;
      }
      if (count > maxInHour) maxInHour = count;
    }
    if (maxInHour >= 10 && !seenPairs.has(k)) {
      seenPairs.add(k);
      const [sid, vid] = k.split('|');
      velocitySpikes.push({ student_id: sid, vendor_id: vid, student_name: '', vendor_name: '', max_in_hour: maxInHour });
    }
  }

  // Enrich velocity spikes
  if (velocitySpikes.length) {
    const vsStudentIds = [...new Set(velocitySpikes.map((s) => s.student_id))];
    const vsVendorIds  = [...new Set(velocitySpikes.map((s) => s.vendor_id))];
    const [{ data: vsStudents }, { data: vsVendors }] = await Promise.all([
      admin.from('profiles').select('id, first_name, last_name, display_name').in('id', vsStudentIds),
      admin.from('vendor_profiles').select('id, business_name').in('id', vsVendorIds),
    ]);
    const vsStudentMap: Record<string, string> = {};
    for (const s of vsStudents ?? []) vsStudentMap[s.id] = s.first_name ? `${s.first_name} ${s.last_name ?? ''}`.trim() : (s.display_name ?? 'Student');
    const vsVendorMap:  Record<string, string> = {};
    for (const v of vsVendors  ?? []) vsVendorMap[v.id]  = v.business_name;

    for (const spike of velocitySpikes) {
      spike.student_name = vsStudentMap[spike.student_id] ?? 'Unknown';
      spike.vendor_name  = vsVendorMap[spike.vendor_id]   ?? 'Unknown';
    }
    velocitySpikes.sort((a, b) => b.max_in_hour - a.max_in_hour);
  }

  return NextResponse.json({
    rate_limit_hits:  rateLimitHits,
    at_risk_vendors:  atRiskVendors,
    velocity_spikes:  velocitySpikes.slice(0, 10),
    generated_at:     now.toISOString(),
  });
}
