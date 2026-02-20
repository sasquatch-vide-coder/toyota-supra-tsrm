-- System metrics table and functions
-- Run on production:
--   PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f scripts/system_metrics.sql

-- ============================================================
-- 1. System metrics table
-- ============================================================

CREATE TABLE IF NOT EXISTS system_metrics (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cpu_pct     REAL NOT NULL,        -- 0-100
  mem_pct     REAL NOT NULL,        -- 0-100
  net_rx_mb   REAL NOT NULL,        -- MB received in last minute
  net_tx_mb   REAL NOT NULL         -- MB transmitted in last minute
);

CREATE INDEX IF NOT EXISTS idx_sm_recorded ON system_metrics (recorded_at DESC);

ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'system_metrics' AND policyname = 'service_read_sm') THEN
    CREATE POLICY "service_read_sm" ON system_metrics FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'system_metrics' AND policyname = 'service_insert_sm') THEN
    CREATE POLICY "service_insert_sm" ON system_metrics FOR INSERT WITH CHECK (true);
  END IF;
END $$;


-- ============================================================
-- 2. Query RPC with adaptive aggregation
-- ============================================================

CREATE OR REPLACE FUNCTION get_system_metrics(
  since TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours'
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result JSON;
  hours_span DOUBLE PRECISION;
BEGIN
  hours_span := EXTRACT(EPOCH FROM (NOW() - since)) / 3600.0;

  IF hours_span <= 25 THEN
    -- Today: raw 1-min data
    SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.recorded_at), '[]'::json)
    INTO result
    FROM (
      SELECT recorded_at, cpu_pct, mem_pct, net_rx_mb, net_tx_mb
      FROM system_metrics
      WHERE recorded_at >= since
    ) t;
  ELSIF hours_span <= 168 THEN
    -- 7d: 15-min averages
    SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.recorded_at), '[]'::json)
    INTO result
    FROM (
      SELECT
        date_trunc('hour', recorded_at)
          + (EXTRACT(MINUTE FROM recorded_at)::INT / 15) * INTERVAL '15 minutes'
          AS recorded_at,
        ROUND(AVG(cpu_pct)::NUMERIC, 1)::REAL AS cpu_pct,
        ROUND(AVG(mem_pct)::NUMERIC, 1)::REAL AS mem_pct,
        ROUND(AVG(net_rx_mb)::NUMERIC, 3)::REAL AS net_rx_mb,
        ROUND(AVG(net_tx_mb)::NUMERIC, 3)::REAL AS net_tx_mb
      FROM system_metrics
      WHERE recorded_at >= since
      GROUP BY 1
    ) t;
  ELSE
    -- 30d / all: hourly averages
    SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.recorded_at), '[]'::json)
    INTO result
    FROM (
      SELECT
        date_trunc('hour', recorded_at) AS recorded_at,
        ROUND(AVG(cpu_pct)::NUMERIC, 1)::REAL AS cpu_pct,
        ROUND(AVG(mem_pct)::NUMERIC, 1)::REAL AS mem_pct,
        ROUND(AVG(net_rx_mb)::NUMERIC, 3)::REAL AS net_rx_mb,
        ROUND(AVG(net_tx_mb)::NUMERIC, 3)::REAL AS net_tx_mb
      FROM system_metrics
      WHERE recorded_at >= since
      GROUP BY 1
    ) t;
  END IF;

  RETURN result;
END;
$$;


-- ============================================================
-- 3. Cleanup: delete rows older than 90 days
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_system_metrics()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM system_metrics WHERE recorded_at < NOW() - INTERVAL '90 days';
END;
$$;
