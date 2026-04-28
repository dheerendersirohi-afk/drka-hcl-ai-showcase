# AI-Powered Disaster Management System

A scalable, AI-driven solution for real-time disaster response and resource management.

## Live Preview
- MVP: [Explore the app](https://zingy-naiad-ee539d.netlify.app/)

## Repository
- GitHub: [LittleCodr/solutions-challenge-disastster-managements](https://github.com/LittleCodr/solutions-challenge-disastster-managements.git)

## Overview
This project is a disaster response dashboard built for rapid situational awareness, resource coordination, and community communication during emergencies. The MVP combines real-time geospatial views, incident reporting, analytics, and a Sarvam AI assistant to help teams understand what is happening and act faster.

## Key Capabilities
- Real-time disaster tracking with interactive map and globe views
- AI-assisted analysis for response guidance, severity assessment, and resource planning
- Resource and team coordination backed by Supabase data
- Alert management for emergency communication workflows
- Crowdsourced incident reporting with geo-aware context
- Analytics panels for monitoring trends and active events
- Scalable frontend foundation built with Vite, React, and TypeScript

## Tech Stack
### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Lucide React
- Zustand

### Mapping and Visualization
- Mapbox GL JS
- react-map-gl
- COBE
- Chart.js
- react-chartjs-2

### Backend and Data
- Supabase
- PostgreSQL / PostGIS-ready architecture
- Real-time subscriptions

### AI
- Sarvam AI chat completions for chat, incident analysis, and response support
- Extensible architecture for forecasting and prioritization models

## Getting Started
### 1. Clone the repository
```bash
git clone https://github.com/LittleCodr/solutions-challenge-disastster-managements.git
cd solutions-challenge-disastster-managements
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Create a local `.env` file from `.env.example` and fill in your credentials:

```bash
cp .env.example .env
```

Required variables:
- `VITE_USE_SUPABASE` set to `true` only when your Supabase schema and policies are ready
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SARVAM_API_KEY`

### 4. Start the development server
```bash
npm run dev
```

### 5. Build for production
```bash
npm run build
```

## Available Scripts
- `npm run dev` starts the local development server
- `npm run build` creates the production build
- `npm run preview` previews the production build locally
- `npm run lint` runs ESLint

## WhatsApp Bot
The repo now includes a backend scaffold for a WhatsApp responder bot at `supabase/functions/whatsapp-bot`.

What it supports:
- Twilio WhatsApp inbound webhook handling
- user subscription by city/state
- responder lookup with commands like `TEAM Hapur` or `STATUS Hapur`
- outbound weather/disaster alerts targeted to opted-in subscribers

Setup summary:
1. Apply the new migration in `supabase/migrations/20260416090000_whatsapp_bot_support.sql`
2. Set Supabase function secrets for Twilio and the dispatch/webhook tokens
3. Deploy the Edge Function
4. Point your Twilio WhatsApp webhook to the deployed function URL

Detailed setup and request examples are in `supabase/functions/whatsapp-bot/README.md`.

## Roadmap
- Disaster forecasting models for trend-based prediction
- Automated misinformation detection workflows
- Broader notification integrations such as SMS, IVR, and push alerts
- External government and weather data ingestion
- Low-connectivity and edge-first response flows

## Contributing
Contributions are welcome. Open an issue to discuss ideas, report bugs, or submit a pull request.
