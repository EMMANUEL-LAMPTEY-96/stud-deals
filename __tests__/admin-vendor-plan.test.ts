/**
 * @jest-environment node
 *
 * POST /api/admin/vendor-plan — admin changes a business's plan by hand.
 * Supabase is replaced by a small fake that records every write.
 */

type Row = Record<string, unknown>;
interface Write { table: string; op: 'update' | 'insert'; values: Row; filters: [string, string, unknown][] }

const state = {
  user: { id: 'admin-1' } as { id: string } | null,
  role: 'admin',
  vendor: null as Row | null,
  activeOffers: [] as Row[],
  writes: [] as Write[],
};

function builder(table: string) {
  const filters: [string, string, unknown][] = [];
  let op: Write['op'] | null = null;
  let values: Row = {};
  const result = () => {
    if (op) {
      state.writes.push({ table, op, values, filters: [...filters] });
      return { data: null, error: null };
    }
    if (table === 'offers') return { data: state.activeOffers, error: null };
    return { data: null, error: null };
  };
  const b: Record<string, unknown> = {
    select: () => b,
    eq: (c: string, v: unknown) => { filters.push(['eq', c, v]); return b; },
    in: (c: string, v: unknown) => { filters.push(['in', c, v]); return b; },
    order: () => b,
    update: (v: Row) => { op = 'update'; values = v; return b; },
    insert: (v: Row) => { op = 'insert'; values = v; return Promise.resolve(result()); },
    maybeSingle: () => Promise.resolve({
      data: table === 'profiles' ? { role: state.role } : table === 'vendor_profiles' ? state.vendor : null,
      error: null,
    }),
    then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(result()).then(res, rej),
  };
  return b;
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: state.user } }) } }),
  createAdminClient: () => ({ from: (t: string) => builder(t) }),
}));
jest.mock('@/lib/utils/safe-logger', () => ({ safeLog: { error: jest.fn(), info: jest.fn(), warn: jest.fn() } }));

import { POST } from '@/app/api/admin/vendor-plan/route';

const VID = '11111111-1111-4111-8111-111111111111';
const req = (body: unknown) => ({ json: async () => body }) as never;

beforeEach(() => {
  state.user = { id: 'admin-1' };
  state.role = 'admin';
  state.vendor = { id: VID, user_id: 'owner-1', business_name: 'Café', plan_tier: 'free', plan_status: 'free', plan_started_at: null };
  state.activeOffers = [];
  state.writes = [];
});

const vendorUpdate = () => state.writes.find((w) => w.table === 'vendor_profiles' && w.op === 'update')!.values;

describe('POST /api/admin/vendor-plan', () => {
  it('rejects non-admins and signed-out users', async () => {
    state.role = 'vendor';
    expect((await POST(req({ vendor_profile_id: VID, plan_tier: 'pro', plan_status: 'active' }))).status).toBe(403);
    state.user = null;
    expect((await POST(req({ vendor_profile_id: VID, plan_tier: 'pro', plan_status: 'active' }))).status).toBe(401);
    expect(state.writes).toHaveLength(0);
  });

  it('rejects bad input', async () => {
    expect((await POST(req({ vendor_profile_id: 'nope', plan_tier: 'pro', plan_status: 'active' }))).status).toBe(400);
    expect((await POST(req({ vendor_profile_id: VID, plan_tier: 'gold', plan_status: 'active' }))).status).toBe(400);
    expect((await POST(req({ vendor_profile_id: VID, plan_tier: 'growth', plan_status: 'trialing' }))).status).toBe(400);
  });

  it('upgrades to Growth, logs it and notifies the business', async () => {
    const res = await POST(req({ vendor_profile_id: VID, plan_tier: 'growth', plan_status: 'active', paid_until: '2026-12-31' }));
    expect(res.status).toBe(200);
    const u = vendorUpdate();
    expect(u).toMatchObject({ plan_tier: 'growth', plan_status: 'active', trial_ends_at: null });
    expect(u.plan_expires_at).toBe('2026-12-31T23:59:59.000Z');
    expect(u.plan_started_at).toEqual(expect.any(String));
    expect(state.writes.some((w) => w.table === 'admin_audit_log' && w.values.action === 'vendor_plan_changed')).toBe(true);
    expect(state.writes.some((w) => w.table === 'notifications' && w.values.user_id === 'owner-1')).toBe(true);
  });

  it('forces Free tier and free status together', async () => {
    state.vendor!.plan_tier = 'pro'; state.vendor!.plan_status = 'active';
    await POST(req({ vendor_profile_id: VID, plan_tier: 'free', plan_status: 'active' }));
    expect(vendorUpdate()).toMatchObject({ plan_tier: 'free', plan_status: 'free', plan_expires_at: null, plan_started_at: null });
  });

  it('on downgrade, pauses the newest active offers above the limit', async () => {
    state.vendor!.plan_tier = 'pro'; state.vendor!.plan_status = 'active';
    state.activeOffers = [
      { id: 'o1', expires_at: null },
      { id: 'o2', expires_at: '2000-01-01T00:00:00Z' }, // already expired — not counted
      { id: 'o3', expires_at: null },
      { id: 'o4', expires_at: null },
    ];
    const res = await POST(req({ vendor_profile_id: VID, plan_tier: 'free', plan_status: 'free' }));
    const json = await res.json();
    expect(json.offers_paused).toBe(2);
    const pause = state.writes.find((w) => w.table === 'offers' && w.op === 'update')!;
    expect(pause.values).toEqual({ status: 'paused' });
    expect(pause.filters).toContainEqual(['in', 'id', ['o3', 'o4']]);
  });

  it('cancelled paid plans get Free limits', async () => {
    state.vendor!.plan_tier = 'growth'; state.vendor!.plan_status = 'active';
    state.activeOffers = [{ id: 'a', expires_at: null }, { id: 'b', expires_at: null }];
    const json = await (await POST(req({ vendor_profile_id: VID, plan_tier: 'growth', plan_status: 'cancelled' }))).json();
    expect(json.offers_paused).toBe(1);
  });

  it('Pro never pauses offers', async () => {
    state.activeOffers = Array.from({ length: 30 }, (_, i) => ({ id: `o${i}`, expires_at: null }));
    const json = await (await POST(req({ vendor_profile_id: VID, plan_tier: 'pro', plan_status: 'active' }))).json();
    expect(json.offers_paused).toBe(0);
    expect(state.writes.some((w) => w.table === 'offers')).toBe(false);
  });
});
