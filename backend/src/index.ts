import type { Env } from './types';
import { handleAIAnalyze, handleGetUsage } from './handlers';
import { handleCreateCheckout, handleStripeWebhook } from './stripe';
import { ok, corsResponse, notFound } from './responses';

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    // CORS preflight
    if (req.method === 'OPTIONS') return corsResponse();

    const route = `${req.method} ${url.pathname}`;

    switch (route) {
      case 'POST /ai/analyze':
        return handleAIAnalyze(req, env, ctx);

      case 'GET /usage/me':
        return handleGetUsage(req, env);

      case 'POST /stripe/create-checkout':
        return handleCreateCheckout(req, env);

      case 'POST /stripe/webhook':
        return handleStripeWebhook(req, env);

      case 'GET /health':
        return ok({ status: 'ok', ts: new Date().toISOString() });

      default:
        return notFound();
    }
  },
};
