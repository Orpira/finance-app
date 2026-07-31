-- communication_message_correlations
--
-- Relación técnica mínima entre eventId/workflowId/requestId/
-- providerMessageId/referencias opacas de usuario y dispositivo. No guarda
-- ningún dato financiero ni el texto del mensaje — solo lo necesario para
-- correlacionar un envío con su resultado y, más adelante, con los estados
-- que Meta reporte para ese mensaje.

CREATE TABLE IF NOT EXISTS communication_message_correlations (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT,
  workflow_id TEXT,
  request_id TEXT NOT NULL,
  provider_message_id TEXT,
  user_reference TEXT,
  device_reference TEXT,
  status TEXT NOT NULL DEFAULT 'accepted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (request_id)
);

CREATE INDEX IF NOT EXISTS communication_message_correlations_provider_message_id_idx
  ON communication_message_correlations (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS communication_message_correlations_event_id_idx
  ON communication_message_correlations (event_id)
  WHERE event_id IS NOT NULL;

-- ROLLBACK (manual):
-- DROP TABLE IF EXISTS communication_message_correlations;
