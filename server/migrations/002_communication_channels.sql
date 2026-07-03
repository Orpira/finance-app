CREATE TABLE IF NOT EXISTS communication_channels (
  id BIGSERIAL PRIMARY KEY,
  user_code TEXT NOT NULL,
  device_code TEXT,
  provider TEXT NOT NULL CHECK (provider IN ('whatsapp', 'email', 'telegram', 'signal', 'sms')),
  instance_name TEXT,
  phone_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'connected', 'disconnected', 'revoked', 'error')),
  preferences JSONB NOT NULL DEFAULT '{}',
  provider_metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,
  UNIQUE (user_code, provider, instance_name)
);

CREATE INDEX IF NOT EXISTS communication_channels_user_provider_idx
  ON communication_channels (user_code, provider);

CREATE INDEX IF NOT EXISTS communication_channels_status_idx
  ON communication_channels (status);
