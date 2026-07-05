ALTER TABLE communication_channels
  ADD COLUMN IF NOT EXISTS instance_id TEXT,
  ADD COLUMN IF NOT EXISTS owner_jid TEXT,
  ADD COLUMN IF NOT EXISTS profile_name TEXT,
  ADD COLUMN IF NOT EXISTS profile_photo TEXT,
  ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ;

DO $migration$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'communication_channels'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE communication_channels DROP CONSTRAINT %I',
      constraint_name
    );
  END IF;

  ALTER TABLE communication_channels
    ADD CONSTRAINT communication_channels_status_check
    CHECK (status IN (
      'not_configured',
      'pending',
      'connecting',
      'connected',
      'disconnected',
      'revoked',
      'error'
    ));
END;
$migration$;

UPDATE communication_channels AS channel
SET
  instance_name = REGEXP_REPLACE(BTRIM(channel.instance_name), '^=+', ''),
  updated_at = NOW()
WHERE channel.instance_name ~ '^=+'
  AND NOT EXISTS (
    SELECT 1
    FROM communication_channels AS existing
    WHERE existing.id <> channel.id
      AND existing.user_code = channel.user_code
      AND existing.provider = channel.provider
      AND existing.instance_name = REGEXP_REPLACE(BTRIM(channel.instance_name), '^=+', '')
  );

CREATE INDEX IF NOT EXISTS communication_channels_device_provider_idx
  ON communication_channels (device_code, provider);

CREATE INDEX IF NOT EXISTS communication_channels_instance_idx
  ON communication_channels (provider, instance_name);
