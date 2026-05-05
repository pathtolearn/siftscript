export interface Env {
  // Vars (wrangler.toml)
  SUPABASE_URL: string;
  STRIPE_PRICE_MONTHLY: string;
  STRIPE_PRICE_ANNUAL: string;
  ALLOWED_ORIGINS: string;

  // Secrets (wrangler secret put)
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_JWT_SECRET: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  OPENAI_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  GEMINI_API_KEY: string;
}

export type Tier = 'free' | 'pro';
export type UsageField = 'ai_calls' | 'cross_video_calls' | 'transcripts_saved';

export interface Profile {
  id: string;
  tier: Tier;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_period_end: string | null;
}

export interface Usage {
  user_id: string;
  month: string;
  ai_calls: number;
  cross_video_calls: number;
  transcripts_saved: number;
}

export interface TierLimits {
  tier: Tier;
  max_transcripts: number | null;
  ai_calls_per_month: number | null;
  cross_video_per_month: number | null;
}

export interface AIRequest {
  prompt: string;
  type: 'summary' | 'repurpose' | 'cross_video' | 'concepts' | 'generic';
  provider: 'openai' | 'anthropic' | 'gemini';
  model: string;
  format?: 'text' | 'json' | 'markdown';
}
