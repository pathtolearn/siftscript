import type { Env, Profile, Usage, TierLimits, UsageField } from './types';

/** Thin fetch wrapper for Supabase REST API using service role key (bypasses RLS) */
function supaFetch(env: Env, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Prefer': 'return=representation',
      ...(init?.headers as Record<string, string> ?? {}),
    },
  });
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7); // "2026-04"
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function getProfile(userId: string, env: Env): Promise<Profile | null> {
  const res = await supaFetch(env, `profiles?id=eq.${userId}&limit=1`);
  if (!res.ok) return null;
  const rows = await res.json<Profile[]>();
  return rows[0] ?? null;
}

export async function setUserTier(
  userId: string,
  tier: 'free' | 'pro',
  subscriptionId: string | null,
  periodEnd: string | null,
  env: Env,
): Promise<void> {
  await supaFetch(env, `profiles?id=eq.${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      tier,
      stripe_subscription_id: subscriptionId,
      stripe_period_end: periodEnd,
      updated_at: new Date().toISOString(),
    }),
  });
}

export async function setUserTierBySubscription(
  subscriptionId: string,
  tier: 'free' | 'pro',
  env: Env,
): Promise<void> {
  await supaFetch(env, `profiles?stripe_subscription_id=eq.${subscriptionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ tier, updated_at: new Date().toISOString() }),
  });
}

export async function setStripeCustomerId(
  userId: string,
  customerId: string,
  env: Env,
): Promise<void> {
  await supaFetch(env, `profiles?id=eq.${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ stripe_customer_id: customerId }),
  });
}

// ─── Usage ────────────────────────────────────────────────────────────────────

export async function getUsage(userId: string, env: Env): Promise<Usage> {
  const month = currentMonth();
  const res = await supaFetch(env, `usage?user_id=eq.${userId}&month=eq.${month}&limit=1`);
  if (!res.ok) return { user_id: userId, month, ai_calls: 0, cross_video_calls: 0, transcripts_saved: 0 };
  const rows = await res.json<Usage[]>();
  return rows[0] ?? { user_id: userId, month, ai_calls: 0, cross_video_calls: 0, transcripts_saved: 0 };
}

export async function incrementUsage(userId: string, field: UsageField, env: Env): Promise<void> {
  // Call the Postgres RPC function (handles upsert + atomic increment)
  await supaFetch(env, 'rpc/increment_usage', {
    method: 'POST',
    body: JSON.stringify({ p_user_id: userId, p_month: currentMonth(), p_field: field }),
  });
}

// ─── Tier limits ──────────────────────────────────────────────────────────────

export async function getTierLimits(tier: string, env: Env): Promise<TierLimits | null> {
  const res = await supaFetch(env, `tier_limits?tier=eq.${tier}&limit=1`);
  if (!res.ok) return null;
  const rows = await res.json<TierLimits[]>();
  return rows[0] ?? null;
}

// ─── Combined usage check ─────────────────────────────────────────────────────

export interface UsageCheckResult {
  allowed: boolean;
  used: number;
  limit: number | null;
  tier: string;
}

export async function checkUsageAllowed(
  userId: string,
  field: UsageField,
  env: Env,
): Promise<UsageCheckResult> {
  const [profile, usage] = await Promise.all([
    getProfile(userId, env),
    getUsage(userId, env),
  ]);

  const tier = profile?.tier ?? 'free';
  const limits = await getTierLimits(tier, env);

  const limitMap: Record<UsageField, number | null> = {
    ai_calls: limits?.ai_calls_per_month ?? 10,
    cross_video_calls: limits?.cross_video_per_month ?? 2,
    transcripts_saved: limits?.max_transcripts ?? 30,
  };

  const limit = limitMap[field];
  const used = usage[field];

  if (limit === null) return { allowed: true, used, limit: null, tier };
  return { allowed: used < limit, used, limit, tier };
}
