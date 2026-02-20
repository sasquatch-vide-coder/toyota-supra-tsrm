-- Admin dashboard v3: Enhanced analytics functions
-- Adds: comparison metrics, device breakdown, session depth,
--        content model breakdown, entry pages, daily growth

-- ============================================================
-- 1. Enhanced dashboard metrics WITH previous-period comparison
-- ============================================================
CREATE OR REPLACE FUNCTION get_dashboard_metrics(since TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours')
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result JSON;
  period_length INTERVAL;
  prev_since TIMESTAMPTZ;
BEGIN
  -- Calculate the previous period for comparison
  period_length := NOW() - since;
  prev_since := since - period_length;

  SELECT json_build_object(
    -- Current period metrics
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
    'pages_per_session', (
      SELECT COALESCE(ROUND(
        AVG(page_count)::NUMERIC, 1
      ), 0)
      FROM sessions WHERE started_at >= since
    ),
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
    ),

    -- Previous period metrics for comparison
    'prev_total_views', (SELECT COUNT(*) FROM page_views WHERE created_at >= prev_since AND created_at < since),
    'prev_unique_sessions', (SELECT COUNT(DISTINCT session_id) FROM page_views WHERE created_at >= prev_since AND created_at < since),
    'prev_bounce_rate', (
      SELECT COALESCE(ROUND(
        COUNT(*) FILTER (WHERE page_count = 1)::NUMERIC /
        NULLIF(COUNT(*), 0) * 100, 1
      ), 0)
      FROM sessions
      WHERE started_at >= prev_since AND started_at < since
        AND last_seen_at < since - INTERVAL '30 minutes'
    ),
    'prev_avg_duration_seconds', (
      SELECT COALESCE(ROUND(
        AVG(EXTRACT(EPOCH FROM (last_seen_at - started_at)))::NUMERIC, 0
      ), 0)
      FROM sessions WHERE started_at >= prev_since AND started_at < since AND page_count > 1
    ),
    'prev_pages_per_session', (
      SELECT COALESCE(ROUND(
        AVG(page_count)::NUMERIC, 1
      ), 0)
      FROM sessions WHERE started_at >= prev_since AND started_at < since
    )
  ) INTO result;
  RETURN result;
END;
$$;


-- ============================================================
-- 2. Device breakdown (mobile / tablet / desktop)
-- ============================================================
CREATE OR REPLACE FUNCTION get_device_breakdown(
  since TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours'
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result JSON;
BEGIN
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  INTO result
  FROM (
    SELECT
      CASE
        WHEN screen_width < 768  THEN 'mobile'
        WHEN screen_width < 1024 THEN 'tablet'
        ELSE 'desktop'
      END AS device,
      COUNT(*) AS sessions,
      ROUND(COUNT(*)::NUMERIC / NULLIF(SUM(COUNT(*)) OVER (), 0) * 100, 1) AS pct
    FROM sessions
    WHERE started_at >= since AND screen_width IS NOT NULL
    GROUP BY 1
    ORDER BY sessions DESC
  ) t;
  RETURN result;
END;
$$;


-- ============================================================
-- 3. Session depth distribution (pages per session histogram)
-- ============================================================
CREATE OR REPLACE FUNCTION get_session_depth(
  since TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours'
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result JSON;
BEGIN
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  INTO result
  FROM (
    SELECT
      bucket,
      COUNT(*) AS sessions
    FROM (
      SELECT
        CASE
          WHEN page_count = 1 THEN '1 page'
          WHEN page_count BETWEEN 2 AND 3 THEN '2-3'
          WHEN page_count BETWEEN 4 AND 6 THEN '4-6'
          WHEN page_count BETWEEN 7 AND 10 THEN '7-10'
          ELSE '11+'
        END AS bucket,
        CASE
          WHEN page_count = 1 THEN 1
          WHEN page_count BETWEEN 2 AND 3 THEN 2
          WHEN page_count BETWEEN 4 AND 6 THEN 3
          WHEN page_count BETWEEN 7 AND 10 THEN 4
          ELSE 5
        END AS sort_order
      FROM sessions
      WHERE started_at >= since
    ) sub
    GROUP BY bucket, sort_order
    ORDER BY sort_order
  ) t;
  RETURN result;
END;
$$;


-- ============================================================
-- 4. Content model breakdown (views per model)
-- ============================================================
CREATE OR REPLACE FUNCTION get_content_breakdown(
  since TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours'
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result JSON;
BEGIN
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  INTO result
  FROM (
    SELECT
      model,
      views,
      ROUND(views::NUMERIC / NULLIF(SUM(views) OVER (), 0) * 100, 1) AS pct
    FROM (
      SELECT
        CASE
          WHEN path LIKE '/mk4%' THEN 'MK4 Supra'
          WHEN path LIKE '/mk3%' THEN 'MK3 Supra'
          WHEN path LIKE '/mk2%' THEN 'MK2 Celica-Supra'
          WHEN path = '/' THEN 'Homepage'
          ELSE 'Other'
        END AS model,
        COUNT(*) AS views
      FROM page_views
      WHERE created_at >= since
      GROUP BY 1
    ) sub
    ORDER BY views DESC
  ) t;
  RETURN result;
END;
$$;


-- ============================================================
-- 5. Entry pages (where visitors land first)
-- ============================================================
CREATE OR REPLACE FUNCTION get_entry_pages(
  since TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours',
  lim INT DEFAULT 10
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result JSON;
BEGIN
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  INTO result
  FROM (
    SELECT
      entry_page AS path,
      COUNT(*) AS sessions,
      ROUND(
        COUNT(*) FILTER (WHERE page_count = 1)::NUMERIC /
        NULLIF(COUNT(*), 0) * 100, 0
      ) AS bounce_pct
    FROM sessions
    WHERE started_at >= since
    GROUP BY entry_page
    ORDER BY sessions DESC
    LIMIT lim
  ) t;
  RETURN result;
END;
$$;


-- ============================================================
-- 6. Daily unique visitors for growth tracking (last 90 days)
-- ============================================================
CREATE OR REPLACE FUNCTION get_daily_visitors(
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
      COALESCE(v.visitors, 0) AS visitors,
      COALESCE(v.views, 0) AS views
    FROM generate_series(
      since::DATE,
      CURRENT_DATE,
      '1 day'::INTERVAL
    ) AS d(day)
    LEFT JOIN (
      SELECT
        created_at::DATE AS day,
        COUNT(DISTINCT session_id) AS visitors,
        COUNT(*) AS views
      FROM page_views
      WHERE created_at >= since
      GROUP BY 1
    ) v ON v.day = d.day::DATE
    ORDER BY d.day
  ) t;
  RETURN result;
END;
$$;


-- ============================================================
-- 7. Live active sessions (currently browsing)
-- ============================================================
CREATE OR REPLACE FUNCTION get_live_sessions()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result JSON;
BEGIN
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  INTO result
  FROM (
    SELECT
      s.id,
      s.entry_page,
      s.page_count,
      EXTRACT(EPOCH FROM (NOW() - s.started_at))::INT AS duration_seconds,
      s.screen_width,
      CASE
        WHEN s.screen_width < 768  THEN 'mobile'
        WHEN s.screen_width < 1024 THEN 'tablet'
        ELSE 'desktop'
      END AS device,
      (
        SELECT pv.path FROM page_views pv
        WHERE pv.session_id = s.id
        ORDER BY pv.created_at DESC LIMIT 1
      ) AS current_page
    FROM sessions s
    WHERE s.last_seen_at >= NOW() - INTERVAL '5 minutes'
    ORDER BY s.last_seen_at DESC
    LIMIT 20
  ) t;
  RETURN result;
END;
$$;


-- ============================================================
-- 8. Hourly heatmap by day-of-week
-- ============================================================
CREATE OR REPLACE FUNCTION get_hourly_heatmap(
  since TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days'
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result JSON;
BEGIN
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  INTO result
  FROM (
    SELECT
      EXTRACT(DOW FROM created_at)::INT AS dow,
      EXTRACT(HOUR FROM created_at)::INT AS hour,
      COUNT(*) AS views
    FROM page_views
    WHERE created_at >= since
    GROUP BY 1, 2
    ORDER BY 1, 2
  ) t;
  RETURN result;
END;
$$;
