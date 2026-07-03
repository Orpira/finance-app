CREATE TABLE IF NOT EXISTS licenses (
  license_key TEXT PRIMARY KEY,
  user_code TEXT,
  license_type TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked')),
  device_policy TEXT NOT NULL DEFAULT 'multi'
    CHECK (device_policy IN ('multi', 'single')),
  max_devices INTEGER NOT NULL DEFAULT 3 CHECK (max_devices >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS license_devices (
  id BIGSERIAL PRIMARY KEY,
  license_key TEXT NOT NULL REFERENCES licenses(license_key) ON DELETE CASCADE,
  user_code TEXT,
  device_code TEXT NOT NULL,
  device_name TEXT,
  platform TEXT NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked')),
  UNIQUE (license_key, device_code)
);

CREATE INDEX IF NOT EXISTS license_devices_active_idx
  ON license_devices (license_key, status);

-- Runtime installs the concurrency-safe authorize_license_device function.
