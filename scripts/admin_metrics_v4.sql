-- Admin dashboard v4: Improved content categorization + browser breakdown

-- ============================================================
-- 1. Better content breakdown (separates landing variants from "Other")
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
          WHEN path ~ '^/v[0-9]+' THEN 'Landing Variants'
          WHEN path LIKE '/search%' THEN 'Search'
          WHEN path LIKE '/forum%' THEN 'Forums'
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
-- 2. Browser breakdown (parses user_agent for browser info)
-- ============================================================
CREATE OR REPLACE FUNCTION get_browser_breakdown(
  since TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours'
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result JSON;
BEGIN
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  INTO result
  FROM (
    SELECT
      browser,
      COUNT(*) AS sessions,
      ROUND(COUNT(*)::NUMERIC / NULLIF(SUM(COUNT(*)) OVER (), 0) * 100, 1) AS pct
    FROM (
      SELECT
        CASE
          WHEN user_agent ILIKE '%edg/%' THEN 'Edge'
          WHEN user_agent ILIKE '%opr/%' OR user_agent ILIKE '%opera%' THEN 'Opera'
          WHEN user_agent ILIKE '%chrome/%' AND user_agent NOT ILIKE '%edg/%' THEN 'Chrome'
          WHEN user_agent ILIKE '%firefox/%' THEN 'Firefox'
          WHEN user_agent ILIKE '%safari/%' AND user_agent NOT ILIKE '%chrome/%' THEN 'Safari'
          WHEN user_agent IS NULL THEN 'Unknown'
          ELSE 'Other'
        END AS browser
      FROM sessions
      WHERE started_at >= since AND user_agent IS NOT NULL
    ) sub
    GROUP BY browser
    ORDER BY sessions DESC
  ) t;
  RETURN result;
END;
$$;


-- ============================================================
-- 3. OS breakdown (parses user_agent for OS info)
-- ============================================================
CREATE OR REPLACE FUNCTION get_os_breakdown(
  since TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours'
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result JSON;
BEGIN
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  INTO result
  FROM (
    SELECT
      os,
      COUNT(*) AS sessions,
      ROUND(COUNT(*)::NUMERIC / NULLIF(SUM(COUNT(*)) OVER (), 0) * 100, 1) AS pct
    FROM (
      SELECT
        CASE
          WHEN user_agent ILIKE '%windows%' THEN 'Windows'
          WHEN user_agent ILIKE '%macintosh%' OR user_agent ILIKE '%mac os%' THEN 'macOS'
          WHEN user_agent ILIKE '%linux%' AND user_agent NOT ILIKE '%android%' THEN 'Linux'
          WHEN user_agent ILIKE '%android%' THEN 'Android'
          WHEN user_agent ILIKE '%iphone%' OR user_agent ILIKE '%ipad%' THEN 'iOS'
          WHEN user_agent ILIKE '%cros%' THEN 'ChromeOS'
          WHEN user_agent IS NULL THEN 'Unknown'
          ELSE 'Other'
        END AS os
      FROM sessions
      WHERE started_at >= since AND user_agent IS NOT NULL
    ) sub
    GROUP BY os
    ORDER BY sessions DESC
  ) t;
  RETURN result;
END;
$$;


-- ============================================================
-- 4. Screen resolution breakdown
-- ============================================================
CREATE OR REPLACE FUNCTION get_screen_resolutions(
  since TIMESTAMPTZ DEFAULT NOW() - INTERVAL '24 hours'
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE result JSON;
BEGIN
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  INTO result
  FROM (
    SELECT
      screen_width || 'x' || screen_height AS resolution,
      COUNT(*) AS sessions,
      ROUND(COUNT(*)::NUMERIC / NULLIF(SUM(COUNT(*)) OVER (), 0) * 100, 1) AS pct
    FROM sessions
    WHERE started_at >= since
      AND screen_width IS NOT NULL
      AND screen_height IS NOT NULL
    GROUP BY screen_width, screen_height
    ORDER BY sessions DESC
    LIMIT 10
  ) t;
  RETURN result;
END;
$$;
