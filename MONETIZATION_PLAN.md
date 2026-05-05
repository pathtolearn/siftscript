# Monetization & Repositioning Implementation Plan

## Strategic Goal

Transform this extension from "another AI transcript tool" into a **YouTube research library** — the only tool that lets you build, search, and connect knowledge across hundreds of videos over time.

**Target user**: Researchers, students, and content creators who watch YouTube systematically, not casually.

**Monetization model**: Freemium — 30 transcripts + 10 AI analyses/month free, unlimited on Pro ($7/month or $55/year).

---

## Phase 1: Reposition (Days 1–3, no code)

### 1.1 Rename & Rebrand

Pick a name that signals "knowledge library" not "transcript saver":

- Candidates: *VaultTube*, *TranscriptVault*, *ResearchTube*, *TubeBase*, *VidVault*
- Criteria: available on Chrome Web Store, `.com` available or affordable, no trademark conflicts

Update in:
- `wxt.config.ts` — extension name and description
- `public/manifest.json` — if separate
- `package.json` — name field
- All UI strings referencing the old name
- Extension icons (update with new brand)

### 1.2 Chrome Web Store Listing Rewrite

**New description structure:**

```
Headline (45 chars): Build a research library from YouTube

Short description (132 chars):
Save transcripts, search across all your videos, and discover
connections between ideas. Your YouTube knowledge base.

Long description — lead with the problem:
"You watch 20 videos researching a topic. Two weeks later,
you remember nothing and can't find the clip. [Name] fixes this.

Save any YouTube transcript in one click. Search across your
entire library instantly. Use AI to connect ideas across
multiple videos — something no other tool does.

Perfect for: researchers, students, content creators,
journalists, and anyone who learns from YouTube seriously.

What makes it different:
• Cross-video knowledge graph — see how ideas connect
• Segment-level search — find the exact moment in any video
• Persistent library — your data stays local, always yours
• Works with your own AI keys or our managed AI (Pro)
```

### 1.3 Define the Free vs. Pro Tier

| Feature | Free | Pro |
|---|---|---|
| Saved transcripts | 30 | Unlimited |
| AI analyses (summary, repurpose, etc.) | 10/month | Unlimited |
| Cross-video analyses | 2/month | Unlimited |
| Knowledge graph | View only (up to 10 nodes) | Full |
| Export formats | JSON, TXT | + CSV, Markdown, Notion, Obsidian |
| Categories/tags | 3 categories | Unlimited |
| Bulk extract | No | Yes |
| Priority support | No | Yes |
| Own API key bypass | No | Yes (bring your own key, no limits) |

---

## Phase 2: Make the Differentiator Obvious (Weeks 1–2)

### 2.1 Onboarding Flow

**Goal**: New user hits the "aha moment" within 60 seconds — seeing their first knowledge graph connection.

**Implementation**:

Create `project/components/onboarding/OnboardingFlow.tsx`:

```
Step 1 — Welcome (10s)
  "Most people forget 90% of what they watch on YouTube.
   [Name] remembers it for you."
  → CTA: "Save your first transcript"

Step 2 — Save 3 videos (guided)
  "Save 3 videos on any topic to unlock your knowledge graph"
  → Show progress: 1/3, 2/3, 3/3
  → Pre-suggest: "Try searching YouTube for [user's interest]"

Step 3 — Show the graph (aha moment)
  Animate the knowledge graph appearing with connections
  → "These are the ideas connecting your videos"
  → CTA: "Explore your library"
```

**Trigger logic** (`project/lib/utils/onboarding.ts`):
- Show on first dashboard open if `settings.onboardingComplete !== true`
- Skip if user already has 3+ transcripts saved
- Mark complete after Step 3 or after manual dismissal
- Store state in Dexie `settings` table: `onboardingComplete`, `onboardingStep`

**Files to create/modify**:
- `project/components/onboarding/OnboardingFlow.tsx` — multi-step wizard
- `project/components/onboarding/OnboardingStep.tsx` — individual step wrapper
- `project/lib/utils/onboarding.ts` — state management
- `project/entrypoints/options/App.tsx` — mount onboarding on first load

### 2.2 Promote the Knowledge Graph to Hero

Currently the knowledge graph (`KnowledgeGraphPanel.tsx`) is buried in bulk actions. Move it to a top-level tab.

**Dashboard tab restructure**:

```
Before: Dashboard | Library | Settings
After:  Library | Knowledge Graph | Settings
```

- Remove the generic "Dashboard" tab
- "Library" becomes the default view (transcript list)
- "Knowledge Graph" is the new second tab — your differentiator front and center
- Rename `KnowledgeGraphPanel` → make it a full-page experience

**Changes to**:
- `project/entrypoints/options/App.tsx` — update tab definitions
- `project/components/dashboard/DashboardView.tsx` — restructure
- `project/components/dashboard/KnowledgeGraphPanel.tsx` — expand to full-page view with better empty state: *"Save 3+ videos on any topic to see how their ideas connect"*

### 2.3 Simplify the Library UI

The current library has too many controls visible at once. Apply progressive disclosure:

**Primary actions** (always visible):
- Search bar
- Save new transcript (from active tab)
- Transcript cards with title, channel, date, category

**Secondary actions** (behind a "Filter" toggle):
- Category filter
- Status filter (favorites, archived)
- Sort options

**Advanced actions** (behind "..." per card):
- Speaker identification
- Citation generator
- Bulk extract
- Export options

**Changes to**:
- `project/components/dashboard/LibraryView.tsx` — collapse filter sidebar by default, show toggle button
- `project/components/transcript/BulkActions.tsx` — keep but only show when items are selected (already works this way, but simplify the options shown)

---

## Phase 3: Managed AI Backend (Weeks 3–6)

This is the key unlock for monetization. Currently users need their own API keys. 90% of potential paying users won't set that up.

### 3.1 Backend Architecture

**Stack**: Supabase (auth + database) + Vercel Edge Functions (AI proxy)

```
Chrome Extension
    ↓ (HTTPS with user JWT)
Vercel Edge Function (/api/ai)
    ↓
AI Provider (OpenAI / Anthropic)
    ↑
Supabase (user record, usage tracking, subscription status)
```

**Why this stack**:
- Supabase handles auth, user management, and usage tracking for free up to generous limits
- Vercel Edge Functions are cheap and fast for proxying AI calls
- Stripe handles payments with minimal backend code
- No servers to manage

### 3.2 Supabase Schema

```sql
-- Users (extends Supabase auth.users)
create table profiles (
  id uuid references auth.users primary key,
  tier text default 'free' check (tier in ('free', 'pro')),
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz default now()
);

-- Usage tracking (reset monthly)
create table usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  month text, -- "2026-04"
  ai_analyses_used int default 0,
  cross_video_analyses_used int default 0,
  transcripts_saved int default 0
);

-- Limits per tier
create table tier_limits (
  tier text primary key,
  max_transcripts int,      -- null = unlimited
  ai_analyses_per_month int,
  cross_video_per_month int
);

insert into tier_limits values
  ('free', 30, 10, 2),
  ('pro', null, null, null);
```

### 3.3 Vercel Edge Function — AI Proxy

`/api/ai/analyze` endpoint:

```typescript
// Pseudocode for the edge function
export async function POST(req: Request) {
  // 1. Verify JWT from extension
  const user = await verifySupabaseJWT(req.headers.get('Authorization'))
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Check usage limits
  const usage = await getUsage(user.id)
  const limits = await getLimits(user.tier)
  if (limits.ai_analyses_per_month && usage.ai_analyses_used >= limits.ai_analyses_per_month) {
    return Response.json({
      error: 'limit_reached',
      message: 'Upgrade to Pro for unlimited AI analyses'
    }, { status: 429 })
  }

  // 3. Forward to AI provider
  const { type, transcript, options } = await req.json()
  const result = await callAIProvider(type, transcript, options)

  // 4. Increment usage
  await incrementUsage(user.id, 'ai_analyses_used')

  return Response.json(result)
}
```

### 3.4 Extension Changes for Managed AI

Modify `project/lib/utils/ai.ts`:

```typescript
// Add managed AI mode alongside existing BYOK mode
async function callAI(request: AIRequest): Promise<AIResponse> {
  const settings = await getSettings()

  // If user has their own API key configured, use it directly (Pro perk: no limits)
  if (settings.aiProvider && settings.aiApiKey) {
    return callDirectAI(request, settings)
  }

  // Otherwise use managed AI (requires login)
  const session = await getSupabaseSession()
  if (!session) {
    throw new AIError('login_required', 'Sign in to use AI features')
  }

  return callManagedAI(request, session.access_token)
}
```

**New files**:
- `project/lib/utils/managedAI.ts` — proxy calls to your backend
- `project/lib/auth/supabase.ts` — Supabase client + session management
- `project/components/auth/LoginModal.tsx` — sign in / sign up UI
- `project/components/subscription/UpgradeModal.tsx` — shown when limits hit

### 3.5 Usage Limits in the Extension

Add a usage banner to the dashboard:

```
[Free] 7/10 AI analyses used this month  [Upgrade to Pro →]
```

**New component**: `project/components/subscription/UsageBanner.tsx`

Show upgrade modal when:
- Transcript save attempted and count >= 30 (free tier)
- AI feature triggered and monthly limit reached
- Cross-video analysis triggered and monthly limit reached

### 3.6 Stripe Integration

Use Stripe Checkout (hosted page — no PCI compliance needed on your end).

**Flow**:
1. User clicks "Upgrade to Pro" in extension
2. Extension calls your backend: `POST /api/stripe/create-checkout`
3. Backend creates Stripe Checkout session, returns URL
4. Extension opens URL in new tab
5. User completes payment on Stripe's hosted page
6. Stripe webhook hits `POST /api/stripe/webhook`
7. Webhook updates `profiles.tier = 'pro'` in Supabase
8. Extension polls or receives realtime update that tier changed

**Pricing to configure in Stripe**:
- Monthly: $7/month
- Annual: $55/year (saves ~35%, show this prominently)

---

## Phase 4: Auth & Account UI in Extension (Week 5–6)

### 4.1 Account Section in Settings

Add a new "Account" tab to the Settings page:

**Logged out state**:
```
Sign in to unlock AI features and sync your usage across devices.
[Sign In]  [Create Account]
```

**Free tier logged in**:
```
[Avatar] user@email.com
Plan: Free

This month's usage:
AI analyses    ████████░░  8/10
Cross-video    █░░░░░░░░░  1/2
Transcripts    ████░░░░░░  12/30

[Upgrade to Pro — $7/month]
```

**Pro tier**:
```
[Avatar] user@email.com
Plan: Pro ✓
Renews: May 17, 2026

Usage this month: Unlimited
[Manage Subscription]  [Sign Out]
```

**Files to create**:
- `project/components/settings/AccountSettings.tsx`
- `project/components/settings/UsageDisplay.tsx`

---

## Phase 5: Polish & Launch (Week 7)

### 5.1 Chrome Web Store Assets

- New screenshots showing the knowledge graph prominently (screenshot 1 = knowledge graph, not the transcript list)
- Feature graphic (1400×560) with tagline
- Promo tile (440×280)
- Updated icon set with new brand

### 5.2 Landing Page (Optional but recommended)

A single-page site explaining the value prop, with:
- Hero: "Your YouTube research library"
- Feature highlight: knowledge graph GIF/video
- Pricing table (Free vs Pro)
- Install button linking to Chrome Web Store

Can be a simple Next.js app or even a no-code tool (Framer, Webflow).

### 5.3 Pre-launch Checklist

- [ ] Privacy policy URL in Chrome Web Store listing (required)
- [ ] Terms of service
- [ ] Support email configured
- [ ] Stripe in live mode (not test mode)
- [ ] Supabase project on paid plan (to avoid free tier limits)
- [ ] Error monitoring set up (Sentry free tier)
- [ ] Analytics (privacy-friendly: Plausible or Fathom, not Google Analytics — fits the privacy-first brand)

---

## File Change Summary

### New files to create

```
project/
├── components/
│   ├── onboarding/
│   │   ├── OnboardingFlow.tsx
│   │   └── OnboardingStep.tsx
│   ├── auth/
│   │   └── LoginModal.tsx
│   └── subscription/
│       ├── UpgradeModal.tsx
│       └── UsageBanner.tsx
├── lib/
│   ├── auth/
│   │   └── supabase.ts
│   └── utils/
│       ├── managedAI.ts
│       └── onboarding.ts

backend/ (new repo or monorepo subfolder)
├── api/
│   ├── ai/
│   │   └── analyze.ts       (Vercel Edge Function)
│   └── stripe/
│       ├── create-checkout.ts
│       └── webhook.ts
└── supabase/
    └── migrations/
        └── 001_initial.sql
```

### Existing files to modify

```
project/
├── entrypoints/options/App.tsx          — new tab structure + onboarding mount
├── components/dashboard/DashboardView.tsx — restructure tabs
├── components/dashboard/KnowledgeGraphPanel.tsx — promote to hero
├── components/dashboard/LibraryView.tsx  — simplify UI, collapse filters
├── components/transcript/BulkActions.tsx — simplify options
├── components/settings/                  — add Account tab
└── lib/utils/ai.ts                       — add managed AI path
```

---

## Timeline Summary

| Phase | Work | Duration |
|---|---|---|
| 1 — Reposition | Rename, store listing, define tiers | Days 1–3 |
| 2 — UX | Onboarding, knowledge graph hero, UI simplification | Week 1–2 |
| 3 — Backend | Supabase + Vercel AI proxy + Stripe | Week 3–6 |
| 4 — Auth UI | Account settings, usage display, upgrade flow | Week 5–6 |
| 5 — Launch | Store assets, landing page, checklist | Week 7 |

**Total**: ~7 weeks solo to a monetizable v1.

---

## What to Skip (for now)

- Cloud sync of transcripts — too complex, do after you have paying users
- Mobile companion — same
- Firefox support — adds maintenance overhead
- Team/workspace features — wrong audience size for v1
- More AI providers — you already have 4, that's enough
