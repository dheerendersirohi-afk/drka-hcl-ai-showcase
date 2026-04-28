# DRKA(HCL) Showcase Deployment

This project is ready to deploy as the `drka-hcl-ai` Vite app without removing any Sarvam AI, weather, RAG, or mobility modules.

## Recommended URL

Deploy the nested app from:

```text
drka-hcl-ai
```

The root repo includes deployment config for Vercel and Netlify.

## Required Secure Environment Variables

Set these in the hosting dashboard or Vercel Environment Variables. These are server-side function secrets, so they are not bundled into the browser.

```env
SARVAM_API_KEY=your-sarvam-api-key
ACCUWEATHER_API_KEY=your-accuweather-api-key
NOAA_TOKEN=your-noaa-token
AVIATIONSTACK_API_KEY=your-aviationstack-api-key
```

The public app calls same-origin serverless routes:

```text
/api/sarvam-chat
/api/sarvam-asr
/api/sarvam-tts
/api/weather
/api/aviation
/api/health
```

`/api/health` only reports whether each secret is present. It never returns secret values.

`SARVAM_API_KEY` powers Sarvam chat, Saaras V3 speech-to-text, and Bulbul V3 text-to-speech through secure serverless routes.

Optional future live connectors:

```env
VITE_FLIGHT_STATUS_API_KEY=your-flight-status-api-key
VITE_RAIL_STATUS_API_KEY=your-rail-status-api-key
VITE_ROAD_TRAFFIC_API_KEY=your-road-traffic-api-key
```

Optional public disaster response UI:

```env
VITE_DISASTER_RESPONSE_URL=https://your-public-response-ui.example.com
```

If this is not set, localhost development opens `http://localhost:3000/`, while the deployed showcase opens the built-in `/disaster-response` web response console. Do not use a `localhost` URL for a public deployment because visitors' browsers cannot reach your computer.

## Vercel

The repo includes `vercel.json`.

Build command:

```bash
cd drka-hcl-ai && npm run build
```

Output directory:

```text
drka-hcl-ai/dist
```

## Netlify

The repo includes `netlify.toml`.

Build command:

```bash
cd drka-hcl-ai && npm run build
```

Publish directory:

```text
drka-hcl-ai/dist
```

## Safety Note

Any `VITE_` environment variable is bundled for browser use. Keep provider keys in `SARVAM_API_KEY`, `ACCUWEATHER_API_KEY`, `NOAA_TOKEN`, and `AVIATIONSTACK_API_KEY` for the deployed showcase. The `VITE_` provider keys are only kept as local-development fallback values for localhost testing.
