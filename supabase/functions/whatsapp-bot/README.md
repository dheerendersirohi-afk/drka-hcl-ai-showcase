# DRKA(HCL) WhatsApp Bot

This Edge Function gives the project a WhatsApp alert + lookup backend using Twilio WhatsApp.

## What it does

- Receives inbound WhatsApp messages from Twilio
- Lets users subscribe by city/state
- Answers `STATUS <city>` and `TEAM <city>` with matching disaster/team data
- Sends outbound weather/disaster alerts to opted-in subscribers through a secure dispatch endpoint

## Required secrets

Set these as Supabase function secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM`
- `WHATSAPP_WEBHOOK_TOKEN`
- `WHATSAPP_DISPATCH_SECRET`

## Deploy

```bash
supabase functions deploy whatsapp-bot
```

## Twilio webhook

Point your Twilio WhatsApp webhook to:

```text
https://<your-project-ref>.functions.supabase.co/whatsapp-bot?token=<WHATSAPP_WEBHOOK_TOKEN>
```

## Supported inbound commands

- `HELP`
- `SUBSCRIBE Hapur, Uttar Pradesh`
- `STATUS Hapur`
- `TEAM Hapur`
- `LANGUAGE Hindi`
- `UNSUBSCRIBE`

## Dispatching alerts

Send a `POST` request to:

```text
https://<your-project-ref>.functions.supabase.co/whatsapp-bot/dispatch
```

Headers:

```text
x-dispatch-secret: <WHATSAPP_DISPATCH_SECRET>
content-type: application/json
```

Body example:

```json
{
  "eventType": "weather",
  "title": "Severe weather warning",
  "message": "Heavy rainfall and flood risk expected in Hapur over the next 6 hours.",
  "locationName": "Hapur, Uttar Pradesh",
  "city": "Hapur",
  "state": "Uttar Pradesh",
  "includeResponders": true
}
```
