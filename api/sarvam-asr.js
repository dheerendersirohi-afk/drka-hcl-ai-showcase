import { fetchJson, handleOptions, readJson, requireEnv, sendJson } from './_utils.js';

const SARVAM_ASR_URL = 'https://api.sarvam.ai/speech-to-text';

function normalizeAudioMimeType(value) {
  return String(value || 'audio/webm')
    .split(';')[0]
    .trim()
    .toLowerCase() || 'audio/webm';
}

export default async function sarvamAsr(req, res) {
  if (handleOptions(req, res)) {
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: { message: 'Use POST for Sarvam Saaras ASR.' } });
    return;
  }

  try {
    const apiKey = requireEnv('SARVAM_API_KEY');
    const body = await readJson(req);
    const audioBase64 = String(body.audioBase64 || '').trim();
    const mimeType = normalizeAudioMimeType(body.mimeType);
    const fileName = String(body.fileName || 'drka-voice.webm').trim();

    if (!audioBase64) {
      sendJson(res, 400, { error: { message: 'audioBase64 is required.' } });
      return;
    }

    const audioBuffer = Buffer.from(audioBase64, 'base64');
    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer], { type: mimeType }), fileName);
    formData.append('model', body.model || 'saaras:v3');
    formData.append('mode', body.mode || 'transcribe');
    formData.append('language_code', body.language_code || 'unknown');

    const data = await fetchJson(
      SARVAM_ASR_URL,
      {
        method: 'POST',
        headers: {
          'api-subscription-key': apiKey,
        },
        body: formData,
      },
      30000
    );

    sendJson(res, 200, data);
  } catch (error) {
    const status = error.status || 500;
    sendJson(res, status, {
      error: {
        message: error.message || 'Sarvam Saaras ASR proxy failed.',
        upstream: error.payload,
      },
    });
  }
}
