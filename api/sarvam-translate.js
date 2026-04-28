import { fetchJson, handleOptions, readJson, requireEnv, sendJson } from './_utils.js';

const SARVAM_TRANSLATE_URL = 'https://api.sarvam.ai/translate';
const TRANSLATION_MODELS = new Set(['mayura:v1', 'sarvam-translate:v1']);
const TRANSLATION_MODES = new Set(['formal', 'modern-colloquial', 'classic-colloquial', 'code-mixed']);
const MAX_INPUT_CHARS = 2000;

export default async function sarvamTranslate(req, res) {
  if (handleOptions(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: { message: 'Use POST for Sarvam translation.' } });
    return;
  }

  try {
    const apiKey = requireEnv('SARVAM_API_KEY');
    const body = await readJson(req);
    const input = String(body.input || '').trim();
    const targetLanguageCode = String(body.target_language_code || '').trim();
    const model = TRANSLATION_MODELS.has(body.model) ? body.model : 'sarvam-translate:v1';
    const requestedSourceLanguageCode = String(body.source_language_code || 'auto').trim();
    const sourceLanguageCode =
      model === 'sarvam-translate:v1' && requestedSourceLanguageCode === 'auto'
        ? 'en-IN'
        : requestedSourceLanguageCode;
    const mode = TRANSLATION_MODES.has(body.mode) ? body.mode : 'formal';

    if (!input) {
      sendJson(res, 400, { error: { message: 'input is required.' } });
      return;
    }

    if (input.length > MAX_INPUT_CHARS) {
      sendJson(res, 400, { error: { message: `input must be ${MAX_INPUT_CHARS} characters or fewer.` } });
      return;
    }

    if (!targetLanguageCode) {
      sendJson(res, 400, { error: { message: 'target_language_code is required.' } });
      return;
    }

    const payload = {
      input,
      source_language_code: sourceLanguageCode,
      target_language_code: targetLanguageCode,
      model,
      mode,
    };

    const data = await fetchJson(SARVAM_TRANSLATE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    sendJson(res, 200, data);
  } catch (error) {
    const status = error.status || 500;
    sendJson(res, status, {
      error: {
        message: error.message || 'Sarvam translation proxy failed.',
        upstream: error.payload,
      },
    });
  }
}
