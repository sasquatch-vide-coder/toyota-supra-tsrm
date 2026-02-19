-- Admin dashboard v2 metrics: time-series and peak-hours RPCs
-- Also updates get_dashboard_metrics with new_sessions / returning_sessions

-- RPC: traffic time-series by model, bucketed by hour or day
CREATE OR REPLACE FUNCTION get_traffic_timeseries(
  since TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours',
  bucket TEXT DEFAULT 'hour'
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result JSON;
BEGIN
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.ts), '[]'::json)
  INTO result
  FROM (
    SELECT
      DATE_TRUNC(bucket, created_at) AS ts,
      COUNT(*) FILTER (WHERE path LIKE '/mk4%') AS mk4,
      COUNT(*) FILTER (WHERE path LIKE '/mk3%') AS mk3,
      COUNT(*) FILTER (WHERE path LIKE '/mk2%') AS mk2,
      COUNT(*) FILTER (WHERE path NOT LIKE '/mk4%' AND path NOT LIKE '/mk3%' AND path NOT LIKE '/mk2%') AS other
    FROM page_views
    WHERE created_at >= since
    GROUP BY 1
    ORDER BY 1
  ) t;
  RETURN result;
END;
$$;

-- RPC: peak hours (24 rows, hour 0-23)
CREATE OR REPLACE FUNCTION get_peak_hours(
  since TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours'
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result JSON;
BEGIN
  -- Generate all 24 hours and left-join with actual data so missing hours appear as 0
  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.hour), '[]'::json)
  INTO result
  FROM (
    SELECT h.hour, COALESCE(v.views, 0) AS views
    FROM generate_series(0, 23) AS h(hour)
    LEFT JOIN (
      SELECT EXTRACT(HOUR FROM created_at)::INT AS hour, COUNT(*) AS views
      FROM page_views
      WHERE created_at >= since
      GROUP BY 1
    ) v USING (hour)
    ORDER BY h.hour
  ) t;
  RETURN result;
END;
$$;

-- Update get_dashboard_metrics to include new_sessions and returning_sessions
CREATE OR REPLACE FUNCTION get_dashboard_metrics(since TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours')
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result JSON;
BEGIN
  SELECT json_build_object(
    'total_views', (SELECT COUNT(*) FROM page_views WHERE created_at >= since),
    'unique_sessions', (SELECT COUNT(DISTINCT session_id) FROM page_views WHERE created_at >= since),
    'active_now', (SELECT COUNT(*) FROM sessions WHERE last_seen_at >= NOW() - INTERVAL '5 minutes'),
    'bounce_rate', (
      SELECT COALESCE(ROUND(
        COUNT(*) FILTER (WHERE page_count = 1)::NUMERIC /
        NULLIF(COUNT(*), 0) * 100, 1
      ), 0)
      FROM sessions
      WHERE started_at >= since
        AND last_seen_at < NOW() - INTERVAL '30 minutes'
    ),
    'avg_duration_seconds', (
      SELECT COALESCE(ROUND(
        AVG(EXTRACT(EPOCH FROM (last_seen_at - started_at)))::NUMERIC, 0
      ), 0)
      FROM sessions WHERE started_at >= since AND page_count > 1
    ),
    'new_sessions', (SELECT COUNT(*) FROM sessions WHERE started_at >= since),
    'returning_sessions', (SELECT COUNT(*) FROM sessions WHERE started_at < since AND last_seen_at >= since),
    'top_pages', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT path, COUNT(*) as views FROM page_views
        WHERE created_at >= since GROUP BY path ORDER BY views DESC LIMIT 20
      ) t
    ),
    'top_referrers', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT referrer, COUNT(*) as count FROM page_views
        WHERE created_at >= since AND referrer IS NOT NULL AND referrer != ''
        GROUP BY referrer ORDER BY count DESC LIMIT 15
      ) t
    )
  ) INTO result;
  RETURN result;
END;
$$;
