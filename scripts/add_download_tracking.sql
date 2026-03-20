-- Add download tracking to TSRM database
-- Run: PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f scripts/add_download_tracking.sql

-- ============================================================
-- Download events table
-- ============================================================

CREATE TABLE IF NOT EXISTS download_events (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  model      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dl_created ON download_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dl_model   ON download_events (model);

ALTER TABLE download_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'download_events' AND policyname = 'dl_insert') THEN
    CREATE POLICY "dl_insert" ON download_events FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'download_events' AND policyname = 'dl_read') THEN
    CREATE POLICY "dl_read" ON download_events FOR SELECT USING (true);
  END IF;
END $$;


-- ============================================================
-- RPC: get download counts per model
-- ============================================================

CREATE OR REPLACE FUNCTION get_download_counts(
  since TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours'
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result JSON;
BEGIN
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  INTO result
  FROM (
    SELECT
      model,
      COUNT(*) AS downloads
    FROM download_events
    WHERE created_at >= since
    GROUP BY model
    ORDER BY downloads DESC
  ) t;
  RETURN result;
END;
$$;
