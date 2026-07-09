CREATE TABLE IF NOT EXISTS processed_events (
  id bigserial PRIMARY KEY,
  event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  source text,
  payload_hash text NOT NULL,
  status text NOT NULL DEFAULT 'processing',
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS processed_events_event_type_created_at_idx
  ON processed_events (event_type, created_at DESC);
