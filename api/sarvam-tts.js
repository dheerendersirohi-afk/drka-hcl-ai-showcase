import { fetchJson, handleOptions, readJson, requireEnv, sendJson } from './_utils.js';

const SARVAM_TTS_URL = 'https://api.sarvam.ai/text-to-speech';

export default async function sarvamTts(req, res) {
  if (handleOptions(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: { message: 'Use POST for Sarvam TTS.' } });
    return;
  }

  try {
    const apiKey = requireEnv('SARVAM_API_KEY');
    const body = await readJson(req);
    const text = String(body.text || '').trim();

    if (!text) {
      sendJson(res, 400, { error: { message: 'text is required.' } });
      return;
    }

    const data = await fetchJson(SARVAM_TTS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey,
      },
      body: JSON.stringify({
        text,
        target_language_code: body.target_language_code || 'en-IN',
        speaker: body.speaker || 'shubh',
        model: body.model || 'bulbul:v3',
        pace: typeof body.pace === 'number' ? body.pace : 1,
      }),
    });

    sendJson(res, 200, data);
  } catch (error) {
    const status = error.status || 500;
    sendJson(res, status, {
      error: {
        message: error.message || 'Sarvam TTS proxy failed.',
        upstream: error.payload,
      },
    });
  }
};
