const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function ok(body: unknown): Response {
  return Response.json(body, { headers: CORS_HEADERS });
}

export function corsResponse(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function unauthorized(message = 'Unauthorized'): Response {
  return Response.json({ error: 'unauthorized', message }, { status: 401, headers: CORS_HEADERS });
}

export function badRequest(message: string): Response {
  return Response.json({ error: 'bad_request', message }, { status: 400, headers: CORS_HEADERS });
}

export function notFound(): Response {
  return Response.json({ error: 'not_found' }, { status: 404, headers: CORS_HEADERS });
}

export function limitReached(used: number, limit: number, field: string): Response {
  return Response.json(
    {
      error: 'limit_reached',
      used,
      limit,
      message: `You've used ${used}/${limit} ${field.replace(/_/g, ' ')} this month. Upgrade to Pro for unlimited access.`,
    },
    { status: 429, headers: CORS_HEADERS },
  );
}

export function serverError(message = 'Internal server error'): Response {
  return Response.json({ error: 'server_error', message }, { status: 500, headers: CORS_HEADERS });
}
