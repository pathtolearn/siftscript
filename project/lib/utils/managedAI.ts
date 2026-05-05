import { getAccessToken } from '../auth/supabase';

const WORKER_URL = (import.meta.env.VITE_WORKER_URL as string | undefined) ?? '';

export class ManagedAIError extends Error {
  constructor(
    public code: 'login_required' | 'limit_reached' | 'not_configured' | 'request_failed',
    message: string,
    public used?: number,
    public limit?: number,
  ) {
    super(message);
    this.name = 'ManagedAIError';
    // Required for correct instanceof checks after TypeScript/bundler transpilation
    Object.setPrototypeOf(this, ManagedAIError.prototype);
  }
}

export type ManagedAIType = 'ai_calls' | 'cross_video_calls';

export async function callManagedAI(
  prompt: string,
  type: ManagedAIType,
  provider: string,
  model: string,
  format: 'text' | 'json' | 'markdown' = 'text',
): Promise<string> {
  if (!WORKER_URL) {
    throw new ManagedAIError('not_configured', 'Managed AI is not configured');
  }

  const token = await getAccessToken();
  if (!token) {
    throw new ManagedAIError('login_required', 'Sign in to use AI features without your own API key');
  }

  let res: Response;
  try {
    res = await fetch(`${WORKER_URL}/ai/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ prompt, type, provider, model, format }),
    });
  } catch {
    throw new ManagedAIError('request_failed', 'Could not reach VidSage servers. Check your connection.');
  }

  if (res.status === 401) {
    throw new ManagedAIError('login_required', 'Session expired. Please sign in again.');
  }

  if (res.status === 429) {
    const data = await res.json().catch(() => ({})) as { used?: number; limit?: number; message?: string };
    throw new ManagedAIError(
      'limit_reached',
      data.message ?? 'Monthly AI limit reached. Upgrade to Pro for unlimited access.',
      data.used,
      data.limit,
    );
  }

  if (!res.ok) {
    throw new ManagedAIError('request_failed', `AI request failed (${res.status})`);
  }

  const body = await res.json() as { result: string };
  return body.result;
}

// ─── Usage fetching ───────────────────────────────────────────────────────────

export interface UsageData {
  tier: 'free' | 'pro';
  stripe_period_end: string | null;
  month: string;
  usage: {
    ai_calls: number;
    cross_video_calls: number;
    transcripts_saved: number;
  };
  limits: {
    ai_calls: number | null;
    cross_video_calls: number | null;
    transcripts_saved: number | null;
  };
}

export async function fetchUsage(): Promise<UsageData | null> {
  if (!WORKER_URL) return null;

  const token = await getAccessToken();
  if (!token) return null;

  try {
    const res = await fetch(`${WORKER_URL}/usage/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json() as UsageData;
  } catch {
    return null;
  }
}

export async function createCheckoutSession(plan: 'monthly' | 'annual'): Promise<string> {
  if (!WORKER_URL) throw new Error('Not configured');

  const token = await getAccessToken();
  if (!token) throw new ManagedAIError('login_required', 'Sign in to upgrade');

  const res = await fetch(`${WORKER_URL}/stripe/create-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ plan }),
  });

  if (!res.ok) throw new Error('Failed to create checkout session');
  const { url } = await res.json() as { url: string };
  return url;
}
