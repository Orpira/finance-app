DO $migration$
DECLARE
  legacy_constraint_name TEXT;
BEGIN
  SELECT conname INTO legacy_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'communication_channels'::regclass
    AND contype = 'u'
    AND pg_get_constraintdef(oid) ILIKE '%(user_code, provider, instance_name)%'
  LIMIT 1;

  IF legacy_constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE communication_channels DROP CONSTRAINT %I',
      legacy_constraint_name
    );
  END IF;
END;
$migration$;

CREATE UNIQUE INDEX IF NOT EXISTS communication_channels_user_device_provider_idx
  ON communication_channels (user_code, device_code, provider);

CREATE INDEX IF NOT EXISTS communication_channels_device_provider_idx
  ON communication_channels (device_code, provider);
