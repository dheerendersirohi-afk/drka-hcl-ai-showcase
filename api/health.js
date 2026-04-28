import { handleOptions, sendJson } from './_utils.js';

export default async function health(req, res) {
  if (handleOptions(req, res)) {
    return;
  }

  sendJson(res, 200, {
    ok: true,
    secureEnv: {
      sarvam: Boolean(process.env.SARVAM_API_KEY),
      saaras: Boolean(process.env.SARVAM_API_KEY),
      sarvamTranslate: Boolean(process.env.SARVAM_API_KEY),
      sarvamVision: Boolean(process.env.SARVAM_API_KEY),
      accuweather: Boolean(process.env.ACCUWEATHER_API_KEY),
      noaa: Boolean(process.env.NOAA_TOKEN),
      aviationstack: Boolean(process.env.AVIATIONSTACK_API_KEY),
    },
  });
};
