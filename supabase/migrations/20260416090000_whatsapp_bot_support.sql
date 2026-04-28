/*
  # WhatsApp Bot Support

  1. New tables
    - whatsapp_subscriptions
      - Stores opted-in WhatsApp recipients and their geography/language preferences
    - whatsapp_alert_logs
      - Stores outbound WhatsApp delivery attempts for audit/debugging

  2. Security
    - RLS enabled on both tables
    - Intended for service-role access via Edge Functions
*/

CREATE TABLE IF NOT EXISTS whatsapp_subscriptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_number text NOT NULL UNIQUE,
  display_name text,
  city text,
  district text,
  state text,
  language_code text NOT NULL DEFAULT 'hi-IN'
    CHECK (language_code IN ('en-IN', 'hi-IN', 'gu-IN', 'mr-IN', 'bn-IN')),
  opted_in boolean NOT NULL DEFAULT true,
  last_inbound_at timestamptz,
  last_alerted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS whatsapp_alert_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id uuid REFERENCES whatsapp_subscriptions(id) ON DELETE SET NULL,
  phone_number text NOT NULL,
  location_name text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('weather', 'disaster', 'manual')),
  title text NOT NULL,
  message text NOT NULL,
  status text NOT NULL CHECK (status IN ('queued', 'sent', 'failed')),
  provider_sid text,
  provider_response jsonb,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS whatsapp_subscriptions_city_idx
  ON whatsapp_subscriptions (LOWER(city));

CREATE INDEX IF NOT EXISTS whatsapp_subscriptions_state_idx
  ON whatsapp_subscriptions (LOWER(state));

CREATE INDEX IF NOT EXISTS whatsapp_subscriptions_opted_in_idx
  ON whatsapp_subscriptions (opted_in);

CREATE INDEX IF NOT EXISTS whatsapp_alert_logs_location_idx
  ON whatsapp_alert_logs (LOWER(location_name));

ALTER TABLE whatsapp_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_alert_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages whatsapp subscriptions" ON whatsapp_subscriptions;
CREATE POLICY "Service role manages whatsapp subscriptions"
  ON whatsapp_subscriptions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages whatsapp alert logs" ON whatsapp_alert_logs;
CREATE POLICY "Service role manages whatsapp alert logs"
  ON whatsapp_alert_logs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS set_updated_at_whatsapp_subscriptions ON whatsapp_subscriptions;
CREATE TRIGGER set_updated_at_whatsapp_subscriptions
  BEFORE UPDATE ON whatsapp_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
