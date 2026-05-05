import type { Env } from './types';

/**
 * Verify a Supabase-issued JWT (HS256) using the project's JWT secret.
 * Returns the user UUID (sub claim) or null if invalid/expired.
 */
export async function verifyJWT(req: Request, env: Env): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7).trim();
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    // Decode payload
    const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadJson) as { sub?: string; exp?: number; role?: string };

    // Check expiry
    if (!payload.exp || payload.exp < Date.now() / 1000) return null;

    // Verify signature
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(env.SUPABASE_JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    const signatureInput = `${parts[0]}.${parts[1]}`;
    const signatureBytes = Uint8Array.from(
      atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0),
    );

    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      new TextEncoder().encode(signatureInput),
    );

    if (!valid) return null;

    return payload.sub ?? null;
  } catch {
    return null;
  }
}
