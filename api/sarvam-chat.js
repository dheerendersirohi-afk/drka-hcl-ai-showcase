import { fetchJson, handleOptions, readJson, requireEnv, sendJson } from './_utils.js';

const SARVAM_CHAT_URL = 'https://api.sarvam.ai/v1/chat/completions';
const SARVAM_REASONING_EFFORTS = new Set(['low', 'medium', 'high']);
const SARVAM_CHAT_MODELS = new Set(['sarvam-30b', 'sarvam-105b', 'sarvam-m']);
const DEFAULT_CHAT_MODEL = 'sarvam-105b';
const DEFAULT_MAX_TOKENS = 2400;
const DEFAULT_REASONING_EFFORT = null;

function hasFinalContent(data) {
  const content = data?.choices?.[0]?.message?.content;

  if (typeof content === 'string') {
    return Boolean(content.trim());
  }

  if (Array.isArray(content)) {
    return content.some((part) => Boolean(part?.text?.trim()));
  }

  return false;
}

async function requestSarvamChat(apiKey, payload) {
  return fetchJson(SARVAM_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
}

export default async function sarvamChat(req, res) {
  if (handleOptions(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: { message: 'Use POST for Sarvam chat.' } });
    return;
  }

  try {
    const apiKey = requireEnv('SARVAM_API_KEY');
    const body = await readJson(req);

    const model = SARVAM_CHAT_MODELS.has(body.model) ? body.model : DEFAULT_CHAT_MODEL;
    const reasoningEffort =
      body.reasoning_effort === null || body.reasoning_effort === 'none'
        ? null
        : SARVAM_REASONING_EFFORTS.has(body.reasoning_effort)
          ? body.reasoning_effort
          : DEFAULT_REASONING_EFFORT;

    const payload = {
      model,
      messages: Array.isArray(body.messages) ? body.messages : [],
      temperature: typeof body.temperature === 'number' ? body.temperature : 0.35,
      max_tokens: typeof body.max_tokens === 'number' ? body.max_tokens : DEFAULT_MAX_TOKENS,
      reasoning_effort: reasoningEffort,
    };

    if (!payload.messages.length) {
      sendJson(res, 400, { error: { message: 'messages are required.' } });
      return;
    }

    let data = await requestSarvamChat(apiKey, payload);

    if (!hasFinalContent(data) && payload.model !== DEFAULT_CHAT_MODEL) {
      data = await requestSarvamChat(apiKey, {
        ...payload,
        model: DEFAULT_CHAT_MODEL,
        max_tokens: Math.max(payload.max_tokens, DEFAULT_MAX_TOKENS),
      });
    }

    sendJson(res, 200, data);
  } catch (error) {
    const status = error.status || 500;
    sendJson(res, status, {
      error: {
        message: error.message || 'Sarvam chat proxy failed.',
        upstream: error.payload,
      },
    });
  }
};
