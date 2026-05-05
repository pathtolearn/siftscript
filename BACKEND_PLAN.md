# Backend Implementation Plan
## Stack: Cloudflare Workers + Supabase + Stripe

---

## Architecture Overview

```
Chrome Extension
  ↓  Supabase Auth SDK (login/signup → JWT)
  ↓  JWT on every AI request
Cloudflare Worker (edge, no cold starts)
  ├─ verify JWT via Supabase JWT secret
  ├─ check + increment usage in Supabase DB
  ├─ proxy to OpenAI / Anthropic / Gemini
  └─ handle Stripe webhooks → update tier in DB
Supabase PostgreSQL
  └─ profiles, usage, tier_limits
Stripe
  └─ hosted checkout → webhook → Worker → Supabase
```

**Key principle**: Workers are stateless. All state lives in Supabase. Workers just verify, check, proxy, and update.

---

## Phase 1 — Supabase Setup

### 1.1 Schema

```sql
-- Extends Supabase auth.users automatically created on signup
create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  tier text not null default 'free' check (tier in ('free', 'pro')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Row-level security: users can only read their own profile
alter table profiles enable row level security;
create policy "own profile" on profiles
  for all using (auth.uid() = id);

-- Auto-create profile on signup (Supabase trigger)
create function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id) values (new.id);
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Usage — one row per user per month
create table usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  month text not null,            -- "2026-04"
  ai_calls int not null default 0,
  cross_video_calls int not null default 0,
  transcripts_saved int not null default 0,
  unique (user_id, month)
);

alter table usage enable row level security;
create policy "own usage" on usage
  for select using (auth.uid() = user_id);

-- Tier limits (seed data)
create table tier_limits (
  tier text primary key,
  max_transcripts int,            -- null = unlimited
  ai_calls_per_month int,         -- null = unlimited
  cross_video_per_month int       -- null = unlimited
);

insert into tier_limits values
  ('free', 30, 10, 2),
  ('pro',  null, null, null);
```

### 1.2 Supabase Auth Config

- Enable **Email/Password** provider
- Enable **magic link** (optional, smoother UX)
- Set Site URL to `chrome-extension://<extension-id>` in Auth settings
- Add redirect URL: `chrome-extension://<extension-id>/options.html`

### 1.3 Secrets needed from Supabase

```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...          ← used in extension (public)
SUPABASE_SERVICE_ROLE_KEY=eyJ...  ← used in Worker only (secret)
SUPABASE_JWT_SECRET=...           ← used in Worker to verify JWTs
```

---

## Phase 2 — Cloudflare Workers

### 2.1 Project structure

```
backend/
├── wrangler.toml
├── package.json
├── src/
│   ├── index.ts            ← router
│   ├── auth.ts             ← JWT verification
│   ├── usage.ts            ← check + increment usage
│   ├── ai.ts               ← proxy to AI providers
│   ├── stripe.ts           ← webhook + checkout session
│   └── types.ts
```

### 2.2 wrangler.toml

```toml
name = "vidsage-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
SUPABASE_URL = "https://xxxx.supabase.co"

# Secrets (set via: wrangler secret put SECRET_NAME)
# SUPABASE_SERVICE_ROLE_KEY
# SUPABASE_JWT_SECRET
# STRIPE_SECRET_KEY
# STRIPE_WEBHOOK_SECRET
# OPENAI_API_KEY       ← your managed AI key
# ANTHROPIC_API_KEY
# GEMINI_API_KEY
```

### 2.3 Routes

| Method | Path | Auth required | Description |
|---|---|---|---|
| POST | `/ai/analyze` | Yes | Proxy AI call, check usage |
| GET | `/usage/me` | Yes | Return current month usage |
| POST | `/stripe/create-checkout` | Yes | Create Stripe checkout session |
| POST | `/stripe/webhook` | No (Stripe sig) | Handle payment events |
| GET | `/health` | No | Uptime check |

### 2.4 src/index.ts — Router

```typescript
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    // CORS preflight
    if (req.method === 'OPTIONS') return corsResponse();

    const route = `${req.method} ${url.pathname}`;

    switch (route) {
      case 'POST /ai/analyze':       return handleAIAnalyze(req, env);
      case 'GET /usage/me':          return handleGetUsage(req, env);
      case 'POST /stripe/create-checkout': return handleCreateCheckout(req, env);
      case 'POST /stripe/webhook':   return handleStripeWebhook(req, env);
      case 'GET /health':            return ok({ status: 'ok' });
      default:                       return notFound();
    }
  }
}
```

### 2.5 src/auth.ts — JWT Verification

```typescript
// Verify Supabase JWT using the JWT secret (HS256)
export async function verifyJWT(req: Request, env: Env): Promise<string | null> {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(env.SUPABASE_JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    // decode header.payload.sig
    const [, payloadB64] = token.split('.');
    const payload = JSON.parse(atob(payloadB64));

    if (payload.exp < Date.now() / 1000) return null;

    return payload.sub as string; // user UUID
  } catch {
    return null;
  }
}
```

### 2.6 src/usage.ts — Check + Increment

```typescript
const MONTH = () => new Date().toISOString().slice(0, 7); // "2026-04"

export async function checkUsage(
  userId: string,
  type: 'ai_calls' | 'cross_video_calls' | 'transcripts_saved',
  env: Env
): Promise<{ allowed: boolean; used: number; limit: number | null }> {
  // Get profile tier
  const profileRes = await supabase(env)
    .from('profiles').select('tier').eq('id', userId).single();
  const tier = profileRes.data?.tier ?? 'free';

  // Get tier limits
  const limitsRes = await supabase(env)
    .from('tier_limits').select('*').eq('tier', tier).single();
  const limit = limitsRes.data?.[type] ?? null; // null = unlimited

  if (limit === null) return { allowed: true, used: 0, limit: null };

  // Get current month usage
  const usageRes = await supabase(env)
    .from('usage')
    .select(type)
    .eq('user_id', userId)
    .eq('month', MONTH())
    .maybeSingle();

  const used = usageRes.data?.[type] ?? 0;
  return { allowed: used < limit, used, limit };
}

export async function incrementUsage(
  userId: string,
  type: 'ai_calls' | 'cross_video_calls' | 'transcripts_saved',
  env: Env
): Promise<void> {
  // Upsert — insert row if not exists, increment if exists
  await supabase(env).rpc('increment_usage', {
    p_user_id: userId,
    p_month: MONTH(),
    p_field: type,
  });
}
```

Add this Postgres function to Supabase:
```sql
create or replace function increment_usage(
  p_user_id uuid,
  p_month text,
  p_field text
) returns void language plpgsql security definer as $$
begin
  insert into usage (user_id, month, ai_calls, cross_video_calls, transcripts_saved)
  values (p_user_id, p_month, 0, 0, 0)
  on conflict (user_id, month) do nothing;

  execute format(
    'update usage set %I = %I + 1 where user_id = $1 and month = $2',
    p_field, p_field
  ) using p_user_id, p_month;
end;
$$;
```

### 2.7 src/ai.ts — AI Proxy

```typescript
export async function handleAIAnalyze(req: Request, env: Env): Promise<Response> {
  // 1. Auth
  const userId = await verifyJWT(req, env);
  if (!userId) return unauthorized();

  const body = await req.json<{ type: string; prompt: string; provider: string; model: string }>();

  // 2. Usage check
  const usageType = body.type === 'cross_video' ? 'cross_video_calls' : 'ai_calls';
  const { allowed, used, limit } = await checkUsage(userId, usageType, env);

  if (!allowed) {
    return Response.json({
      error: 'limit_reached',
      used,
      limit,
      message: `You've used all ${limit} ${usageType.replace('_', ' ')} this month.`,
    }, { status: 429 });
  }

  // 3. Proxy to AI provider
  let result: string;
  switch (body.provider) {
    case 'openai':     result = await callOpenAI(body.prompt, body.model, env); break;
    case 'anthropic':  result = await callAnthropic(body.prompt, body.model, env); break;
    case 'gemini':     result = await callGemini(body.prompt, body.model, env); break;
    default:           return badRequest('Unknown provider');
  }

  // 4. Increment usage (fire-and-forget — don't block the response)
  env.ctx?.waitUntil(incrementUsage(userId, usageType, env));

  return ok({ result });
}
```

### 2.8 src/stripe.ts — Payments

```typescript
// Create Stripe Checkout session
export async function handleCreateCheckout(req: Request, env: Env): Promise<Response> {
  const userId = await verifyJWT(req, env);
  if (!userId) return unauthorized();

  const { plan } = await req.json<{ plan: 'monthly' | 'annual' }>();
  const priceId = plan === 'annual' ? env.STRIPE_PRICE_ANNUAL : env.STRIPE_PRICE_MONTHLY;

  const session = await stripe(env).checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `https://vidsage.app/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `https://vidsage.app/pricing`,
    metadata: { supabase_user_id: userId },
    client_reference_id: userId,
  });

  return ok({ url: session.url });
}

// Stripe webhook — update tier on payment
export async function handleStripeWebhook(req: Request, env: Env): Promise<Response> {
  const sig = req.headers.get('stripe-signature')!;
  const body = await req.text();

  let event;
  try {
    event = await stripe(env).webhooks.constructEventAsync(body, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return badRequest('Invalid webhook signature');
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const userId = session.metadata?.supabase_user_id;
      if (userId) await setUserTier(userId, 'pro', session.subscription as string, env);
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      await setUserTierBySubscription(sub.id, 'free', env);
      break;
    }
  }

  return ok({ received: true });
}
```

---

## Phase 3 — Extension Changes

### 3.1 New files

```
project/lib/auth/
  └── supabase.ts          ← Supabase client + session helpers

project/lib/utils/
  └── managedAI.ts         ← calls Worker instead of AI directly

project/components/auth/
  └── LoginModal.tsx        ← sign in / sign up UI

project/components/subscription/
  ├── UpgradeModal.tsx      ← shown when limit hit
  └── UsageBanner.tsx       ← "7/10 AI uses this month"

project/components/settings/
  └── AccountSettings.tsx   ← account tab in Settings
```

### 3.2 lib/auth/supabase.ts

```typescript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getAccessToken(): Promise<string | null> {
  const session = await getSession();
  return session?.access_token ?? null;
}

export async function signOut() {
  await supabase.auth.signOut();
}
```

### 3.3 lib/utils/managedAI.ts

```typescript
// Called instead of callAI() when user has no BYOK key
export async function callManagedAI(
  prompt: string,
  type: 'ai_calls' | 'cross_video_calls',
  provider: string,
  model: string,
): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error('login_required');

  const res = await fetch('https://vidsage-api.workers.dev/ai/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ prompt, type, provider, model }),
  });

  if (res.status === 429) {
    const data = await res.json();
    throw new Error(`limit_reached:${data.message}`);
  }

  if (!res.ok) throw new Error('AI request failed');

  const { result } = await res.json();
  return result;
}
```

### 3.4 Modify lib/utils/ai.ts

Add a check at the top of `callAI()`:
```typescript
// If no BYOK key configured, route through managed AI
const settings = await getAISettings();
if (!settings?.apiKey) {
  return callManagedAI(prompt, type, defaultProvider, defaultModel);
}
// else existing direct-call logic...
```

### 3.5 UsageBanner.tsx (shown in App header)

```
Free plan  ·  7 / 10 AI uses this month  [Upgrade →]
```

Fetches from `GET /usage/me` on mount, re-fetches after each AI call.

### 3.6 AccountSettings.tsx (new tab in Settings)

**Logged out:**
```
[Sign in to use AI features without your own API key]
[Sign In]  [Create Account]
```

**Free:**
```
user@email.com  ·  Free plan
AI analyses     ██████░░░░  6/10
Cross-video     █░░░░░░░░░  1/2
Transcripts     ████░░░░░░  12/30
[Upgrade to Pro — $7/month or $55/year]
```

**Pro:**
```
user@email.com  ·  Pro ✓
Renews May 17 2027  ·  Unlimited
[Manage Subscription]  [Sign Out]
```

---

## Phase 4 — Stripe Products Setup

In Stripe Dashboard, create:
- Product: **VidSage Pro**
- Price 1: $7.00 / month → save ID as `STRIPE_PRICE_MONTHLY`
- Price 2: $55.00 / year → save ID as `STRIPE_PRICE_ANNUAL`

Webhook events to listen for:
- `checkout.session.completed`
- `customer.subscription.deleted`
- `customer.subscription.updated` (optional — for plan changes)

---

## Deployment

```bash
# 1. Deploy Worker
cd backend
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put SUPABASE_JWT_SECRET
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put OPENAI_API_KEY
wrangler secret put ANTHROPIC_API_KEY
wrangler deploy

# 2. Set Worker URL in extension .env
VITE_WORKER_URL=https://vidsage-api.workers.dev

# 3. Set Supabase keys in extension .env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# 4. Register Stripe webhook
# Point to: https://vidsage-api.workers.dev/stripe/webhook
```

---

## Build order

1. Supabase: create project, run schema SQL, configure Auth
2. Worker: scaffold project, implement auth + usage + AI proxy, deploy
3. Stripe: create products, configure webhook pointing to Worker
4. Extension: add Supabase client, LoginModal, AccountSettings, wire managedAI
5. Test end-to-end: sign up → free AI call → hit limit → upgrade → unlimited

---

## What this costs at scale

| Users | Cloudflare Workers | Supabase | Stripe | Total infra |
|---|---|---|---|---|
| 0–1k MAU | Free | Free | 2.9% + 30¢/txn | ~$0/mo |
| 1k–10k MAU | Free | Free ($25/mo for more DB) | per transaction | ~$25/mo |
| 10k–50k MAU | $5/mo | $25/mo | per transaction | ~$30/mo |

Revenue from 100 Pro users at $7/mo = $700/mo. Infra cost = ~$0–25/mo.
