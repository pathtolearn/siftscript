import type { Env } from './types';
import { verifyJWT } from './auth';
import { getProfile, setUserTier, setUserTierBySubscription, setStripeCustomerId } from './db';
import { ok, unauthorized, badRequest, serverError } from './responses';

function stripeHeaders(env: Env): Record<string, string> {
  return {
    'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
}

async function stripePost(path: string, params: Record<string, string>, env: Env): Promise<unknown> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: stripeHeaders(env),
    body: new URLSearchParams(params).toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Stripe ${path} error ${res.status}: ${err}`);
  }
  return res.json();
}

async function stripeGet(path: string, env: Env): Promise<unknown> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: stripeHeaders(env),
  });
  if (!res.ok) throw new Error(`Stripe GET ${path} error ${res.status}`);
  return res.json();
}

// ─── Create checkout session ──────────────────────────────────────────────────

export async function handleCreateCheckout(req: Request, env: Env): Promise<Response> {
  const userId = await verifyJWT(req, env);
  if (!userId) return unauthorized();

  let body: { plan?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest('Invalid JSON body');
  }

  const plan = body.plan === 'annual' ? 'annual' : 'monthly';
  const priceId = plan === 'annual' ? env.STRIPE_PRICE_ANNUAL : env.STRIPE_PRICE_MONTHLY;

  if (!priceId) return serverError('Stripe price not configured');

  try {
    // Reuse existing Stripe customer if we have one
    const profile = await getProfile(userId, env);
    const customerParam: Record<string, string> = profile?.stripe_customer_id
      ? { customer: profile.stripe_customer_id }
      : { customer_creation: 'always' };

    const session = await stripePost('checkout/sessions', {
      mode: 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url: 'https://vidsage.app/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://vidsage.app/pricing',
      'metadata[supabase_user_id]': userId,
      client_reference_id: userId,
      ...customerParam,
    }, env) as { url: string };

    return ok({ url: session.url });
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Checkout creation failed');
  }
}

// ─── Stripe webhook ───────────────────────────────────────────────────────────

export async function handleStripeWebhook(req: Request, env: Env): Promise<Response> {
  const sig = req.headers.get('stripe-signature');
  if (!sig) return badRequest('Missing stripe-signature header');

  const rawBody = await req.text();

  // Verify webhook signature (HMAC-SHA256)
  const valid = await verifyStripeSignature(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) return badRequest('Invalid webhook signature');

  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return badRequest('Invalid JSON');
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as {
          metadata?: { supabase_user_id?: string };
          customer?: string;
          subscription?: string;
        };
        const userId = session.metadata?.supabase_user_id;
        if (!userId) break;

        // Persist Stripe customer ID for future checkouts
        if (session.customer) {
          await setStripeCustomerId(userId, session.customer, env);
        }

        // Get subscription period end
        let periodEnd: string | null = null;
        if (session.subscription) {
          const sub = await stripeGet(`subscriptions/${session.subscription}`, env) as {
            current_period_end?: number;
          };
          if (sub.current_period_end) {
            periodEnd = new Date(sub.current_period_end * 1000).toISOString();
          }
        }

        await setUserTier(userId, 'pro', session.subscription ?? null, periodEnd, env);
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as {
          id: string;
          status: string;
          current_period_end: number;
          metadata?: { supabase_user_id?: string };
        };
        // Downgrade if subscription becomes past_due or unpaid
        if (['past_due', 'unpaid', 'canceled'].includes(sub.status)) {
          await setUserTierBySubscription(sub.id, 'free', env);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as { id: string };
        await setUserTierBySubscription(sub.id, 'free', env);
        break;
      }
    }
  } catch (err) {
    // Log but return 200 so Stripe doesn't retry
    console.error('Webhook handler error:', err);
  }

  return ok({ received: true });
}

// ─── Stripe signature verification (no SDK needed) ───────────────────────────

async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
): Promise<boolean> {
  try {
    const pairs = Object.fromEntries(sigHeader.split(',').map(p => p.split('=')));
    const timestamp = pairs['t'];
    const signature = pairs['v1'];
    if (!timestamp || !signature) return false;

    // Reject events older than 5 minutes
    if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) return false;

    const signedPayload = `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
    const expected = Array.from(new Uint8Array(mac))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return expected === signature;
  } catch {
    return false;
  }
}
