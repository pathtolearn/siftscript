import type { Env, AIRequest } from './types';
import { verifyJWT } from './auth';
import { checkUsageAllowed, incrementUsage, getUsage, getProfile } from './db';
import { dispatchAI } from './ai';
import { ok, unauthorized, badRequest, limitReached, serverError } from './responses';

// ─── POST /ai/analyze ─────────────────────────────────────────────────────────

export async function handleAIAnalyze(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const userId = await verifyJWT(req, env);
  if (!userId) return unauthorized();

  let body: AIRequest;
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  if (!body.prompt || !body.provider) {
    return badRequest('Missing required fields: prompt, provider');
  }

  // Map request type to usage field
  const usageField = body.type === 'cross_video' ? 'cross_video_calls' : 'ai_calls';

  // Check usage before spending money on AI
  const check = await checkUsageAllowed(userId, usageField, env);
  if (!check.allowed) {
    return limitReached(check.used, check.limit!, usageField);
  }

  // Proxy to AI provider
  let result: string;
  try {
    result = await dispatchAI(body, env);
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'AI request failed');
  }

  // Increment usage — fire-and-forget so it doesn't slow response
  ctx.waitUntil(incrementUsage(userId, usageField, env));

  return ok({ result });
}

// ─── GET /usage/me ────────────────────────────────────────────────────────────

export async function handleGetUsage(req: Request, env: Env): Promise<Response> {
  const userId = await verifyJWT(req, env);
  if (!userId) return unauthorized();

  const [profile, usage] = await Promise.all([
    getProfile(userId, env),
    getUsage(userId, env),
  ]);

  return ok({
    tier: profile?.tier ?? 'free',
    stripe_period_end: profile?.stripe_period_end ?? null,
    month: usage.month,
    usage: {
      ai_calls: usage.ai_calls,
      cross_video_calls: usage.cross_video_calls,
      transcripts_saved: usage.transcripts_saved,
    },
    limits: {
      ai_calls: profile?.tier === 'pro' ? null : 10,
      cross_video_calls: profile?.tier === 'pro' ? null : 2,
      transcripts_saved: profile?.tier === 'pro' ? null : 30,
    },
  });
}
