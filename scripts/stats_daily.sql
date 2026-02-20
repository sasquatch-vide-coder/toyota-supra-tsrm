-- Pre-aggregated daily stats table + optimized RPC functions
-- Replaces heavy raw-table scans with reads from a small summary table

-- ============================================================
-- 1. Summary table: one row per day
-- ============================================================
CREATE TABLE IF NOT EXISTS stats_daily (
  day           DATE PRIMARY KEY,
  visitors      INT NOT NULL DEFAULT 0,   -- COUNT DISTINCT session_id
  views         INT NOT NULL DEFAULT 0,   -- COUNT(*)
  mk4_views     INT NOT NULL DEFAULT 0,
  mk3_views     INT NOT NULL DEFAULT 0,
  mk2_views     INT NOT NULL DEFAULT 0
);


-- ============================================================
-- 2. Refresh a single day from raw page_views
-- ============================================================
CREATE OR REPLACE FUNCTION refresh_stats_daily(target DATE DEFAULT CURRENT_DATE)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO stats_daily (day, visitors, views, mk4_views, mk3_views, mk2_views)
  SELECT
    target,
    COUNT(DISTINCT session_id),
    COUNT(*),
    COUNT(*) FILTER (WHERE path LIKE '/mk4%'),
    COUNT(*) FILTER (WHERE path LIKE '/mk3%'),
    COUNT(*) FILTER (WHERE path LIKE '/mk2%')
  FROM page_views
  WHERE created_at >= target
    AND created_at < target + INTERVAL '1 day'
  ON CONFLICT (day) DO UPDATE SET
    visitors  = EXCLUDED.visitors,
    views     = EXCLUDED.views,
    mk4_views = EXCLUDED.mk4_views,
    mk3_views = EXCLUDED.mk3_views,
    mk2_views = EXCLUDED.mk2_views;
END;
$$;


-- ============================================================
-- 3. Backfill all historical days (run once)
-- ============================================================
CREATE OR REPLACE FUNCTION backfill_stats_daily()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  d DATE;
BEGIN
  FOR d IN
    SELECT DISTINCT created_at::DATE
    FROM page_views
    ORDER BY 1
  LOOP
    PERFORM refresh_stats_daily(d);
  END LOOP;
END;
$$;


-- ============================================================
-- 4. get_stats_metrics — replaces get_dashboard_metrics
--    Returns unique_sessions + prev_unique_sessions from summary table
-- ============================================================
CREATE OR REPLACE FUNCTION get_stats_metrics(
  since TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours'
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result JSON;
  period_length INTERVAL;
  prev_since TIMESTAMPTZ;
BEGIN
  period_length := NOW() - since;
  prev_since := since - period_length;

  SELECT json_build_object(
    'unique_sessions', (
      SELECT COALESCE(SUM(visitors), 0) FROM stats_daily
      WHERE day >= since::DATE
    ),
    'prev_unique_sessions', (
      SELECT COALESCE(SUM(visitors), 0) FROM stats_daily
      WHERE day >= prev_since::DATE AND day < since::DATE
    )
  ) INTO result;
  RETURN result;
END;
$$;


-- ============================================================
-- 5. get_stats_visitors — replaces get_daily_visitors
--    Reads from stats_daily instead of scanning page_views
-- ============================================================
CREATE OR REPLACE FUNCTION get_stats_visitors(
  since TIMESTAMPTZ DEFAULT NOW() - INTERVAL '90 days'
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result JSON;
BEGIN
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.day), '[]'::json)
  INTO result
  FROM (
    SELECT
      d.day::DATE AS day,
      COALESCE(sd.visitors, 0) AS visitors,
      COALESCE(sd.views, 0) AS views
    FROM generate_series(
      since::DATE,
      CURRENT_DATE,
      '1 day'::INTERVAL
    ) AS d(day)
    LEFT JOIN stats_daily sd ON sd.day = d.day::DATE
    ORDER BY d.day
  ) t;
  RETURN result;
END;
$$;


-- ============================================================
-- 6. get_stats_content — replaces get_content_breakdown
--    Computes model percentages from summary columns
-- ============================================================
CREATE OR REPLACE FUNCTION get_stats_content(
  since TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours'
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result JSON;
  total_views BIGINT;
  v_mk4 BIGINT;
  v_mk3 BIGINT;
  v_mk2 BIGINT;
BEGIN
  SELECT
    COALESCE(SUM(mk4_views), 0),
    COALESCE(SUM(mk3_views), 0),
    COALESCE(SUM(mk2_views), 0)
  INTO v_mk4, v_mk3, v_mk2
  FROM stats_daily
  WHERE day >= since::DATE;

  total_views := v_mk4 + v_mk3 + v_mk2;

  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  INTO result
  FROM (
    SELECT model, views,
      ROUND(views::NUMERIC / NULLIF(total_views, 0) * 100, 1) AS pct
    FROM (VALUES
      ('MK4 Supra',        v_mk4),
      ('MK3 Supra',        v_mk3),
      ('MK2 Celica-Supra', v_mk2)
    ) AS v(model, views)
    ORDER BY views DESC
  ) t;
  RETURN result;
END;
$$;
