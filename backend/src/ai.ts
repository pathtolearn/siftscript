import type { Env, AIRequest } from './types';

// ─── OpenAI ───────────────────────────────────────────────────────────────────

async function callOpenAI(prompt: string, model: string, format: string, env: Env): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      ...(format === 'json' ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${err}`);
  }

  const data = await res.json<{ choices: Array<{ message: { content: string } }> }>();
  return data.choices[0]?.message?.content ?? '';
}

// ─── Anthropic ────────────────────────────────────────────────────────────────

async function callAnthropic(prompt: string, model: string, env: Env): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model || 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${err}`);
  }

  const data = await res.json<{ content: Array<{ type: string; text: string }> }>();
  return data.content.find(b => b.type === 'text')?.text ?? '';
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

async function callGemini(prompt: string, model: string, env: Env): Promise<string> {
  const modelId = model || 'gemini-1.5-flash';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error ${res.status}: ${err}`);
  }

  const data = await res.json<{
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
  }>();
  return data.candidates[0]?.content?.parts[0]?.text ?? '';
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

export async function dispatchAI(request: AIRequest, env: Env): Promise<string> {
  const { prompt, provider, model, format = 'text' } = request;

  switch (provider) {
    case 'openai':    return callOpenAI(prompt, model, format, env);
    case 'anthropic': return callAnthropic(prompt, model, env);
    case 'gemini':    return callGemini(prompt, model, env);
    default:          throw new Error(`Unknown provider: ${provider}`);
  }
}
