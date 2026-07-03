ALTER TABLE license_devices
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE license_devices AS device
SET
  user_code = license.user_code,
  updated_at = NOW()
FROM licenses AS license
WHERE device.license_key = license.license_key
  AND device.user_code IS NULL
  AND license.user_code IS NOT NULL;

DO $migration$
BEGIN
  IF to_regclass('public.communication_channels') IS NOT NULL THEN
    EXECUTE $backfill$
      UPDATE license_devices AS device
      SET
        user_code = channel.user_code,
        updated_at = NOW()
      FROM (
        SELECT device_code, MIN(user_code) AS user_code
        FROM communication_channels
        WHERE device_code IS NOT NULL
          AND user_code IS NOT NULL
        GROUP BY device_code
        HAVING COUNT(DISTINCT user_code) = 1
      ) AS channel
      WHERE device.device_code = channel.device_code
        AND device.user_code IS NULL
    $backfill$;
  END IF;
END;
$migration$;

UPDATE licenses AS license
SET
  user_code = source.user_code,
  updated_at = NOW()
FROM (
  SELECT license_key, MIN(user_code) AS user_code
  FROM license_devices
  WHERE user_code IS NOT NULL
  GROUP BY license_key
  HAVING COUNT(DISTINCT user_code) = 1
) AS source
WHERE license.license_key = source.license_key
  AND license.user_code IS NULL;

UPDATE license_devices AS device
SET
  user_code = license.user_code,
  updated_at = NOW()
FROM licenses AS license
WHERE device.license_key = license.license_key
  AND device.user_code IS NULL
  AND license.user_code IS NOT NULL;
