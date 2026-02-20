-- TSRM consolidated database setup
-- Run on a fresh Supabase/PostgreSQL instance to create all tables and functions.
--
-- Usage:
--   PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f scripts/setup.sql


-- ============================================================
-- 1. Manual pages table (search content)
-- ============================================================

CREATE TABLE IF NOT EXISTS manual_pages (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  model          TEXT NOT NULL DEFAULT 'mk3',
  section        TEXT NOT NULL,
  page           INT NOT NULL,
  title          TEXT NOT NULL DEFAULT '',
  section_header TEXT NOT NULL DEFAULT '',
  section_name   TEXT NOT NULL DEFAULT '',
  content_text   TEXT NOT NULL,
  fts            TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(section_header, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(content_text, '')), 'C')
  ) STORED,
  UNIQUE(model, section, page)
);

CREATE INDEX IF NOT EXISTS idx_manual_pages_fts ON manual_pages USING GIN(fts);

ALTER TABLE manual_pages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'manual_pages' AND policyname = 'Allow public read') THEN
    CREATE POLICY "Allow public read" ON manual_pages FOR SELECT USING (true);
  END IF;
END $$;


-- ============================================================
-- 2. Search function (ILIKE substring matching)
-- ============================================================

-- Title matches score 3, section_header matches score 2, content-only matches score 1.
DROP FUNCTION IF EXISTS hybrid_search(text, integer, text);
CREATE OR REPLACE FUNCTION hybrid_search(
  query_text TEXT,
  match_count INT DEFAULT 20,
  filter_model TEXT DEFAULT 'mk3'
)
RETURNS TABLE (
  id BIGINT, section TEXT, page INT, title TEXT, section_header TEXT,
  section_name TEXT, content_text TEXT, score FLOAT
) LANGUAGE sql STABLE AS $$
  SELECT
    mp.id, mp.section, mp.page, mp.title, mp.section_header,
    mp.section_name, LEFT(mp.content_text, 300),
    CASE
      WHEN mp.title ILIKE '%' || query_text || '%' THEN 3.0
      WHEN mp.section_header ILIKE '%' || query_text || '%' THEN 2.0
      ELSE 1.0
    END AS score
  FROM manual_pages mp
  WHERE mp.model = filter_model
    AND (
      mp.title ILIKE '%' || query_text || '%'
      OR mp.section_header ILIKE '%' || query_text || '%'
      OR mp.content_text ILIKE '%' || query_text || '%'
    )
  ORDER BY score DESC, mp.section, mp.page
  LIMIT match_count;
$$;


-- ============================================================
-- 3. Analytics tables
-- ============================================================

-- page_views: individual page-view events
CREATE TABLE IF NOT EXISTS page_views (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id    TEXT NOT NULL,
  path          TEXT NOT NULL CHECK (char_length(path) <= 500),
  referrer      TEXT CHECK (referrer IS NULL OR char_length(referrer) <= 2000),
  user_agent    TEXT,
  screen_width  INT,
  screen_height INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pv_created ON page_views (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pv_session ON page_views (session_id);
CREATE INDEX IF NOT EXISTS idx_pv_path    ON page_views (path);

-- sessions: session-level aggregation
CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  page_count    INT NOT NULL DEFAULT 1,
  entry_page    TEXT NOT NULL,
  referrer      TEXT,
  user_agent    TEXT,
  screen_width  INT,
  screen_height INT
);
CREATE INDEX IF NOT EXISTS idx_sess_last  ON sessions (last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_sess_start ON sessions (started_at DESC);

-- stats_daily: pre-aggregated daily summary (one row per day)
CREATE TABLE IF NOT EXISTS stats_daily (
  day           DATE PRIMARY KEY,
  visitors      INT NOT NULL DEFAULT 0,
  views         INT NOT NULL DEFAULT 0,
  mk4_views     INT NOT NULL DEFAULT 0,
  mk3_views     INT NOT NULL DEFAULT 0,
  mk2_views     INT NOT NULL DEFAULT 0
);


-- ============================================================
-- 4. Analytics RLS
-- ============================================================

ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'page_views' AND policyname = 'anon_insert') THEN
    CREATE POLICY "anon_insert"  ON page_views FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'page_views' AND policyname = 'service_read') THEN
    CREATE POLICY "service_read" ON page_views FOR SELECT USING (true);
  END IF;
END $$;

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sessions' AND policyname = 'service_all') THEN
    CREATE POLICY "service_all" ON sessions USING (true);
  END IF;
END $$;


-- ============================================================
-- 5. Session tracking RPCs
-- ============================================================

-- upsert_session: called on each pageview
CREATE OR REPLACE FUNCTION upsert_session(
  p_id TEXT, p_path TEXT,
  p_referrer TEXT DEFAULT NULL, p_ua TEXT DEFAULT NULL,
  p_sw INT DEFAULT NULL, p_sh INT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO sessions (id, entry_page, referrer, user_agent, screen_width, screen_height)
  VALUES (p_id, p_path, p_referrer, p_ua, p_sw, p_sh)
  ON CONFLICT (id) DO UPDATE SET
    last_seen_at = NOW(),
    page_count = sessions.page_count + 1;
END;
$$;

-- heartbeat_session: updates last_seen without incrementing page_count
CREATE OR REPLACE FUNCTION heartbeat_session(p_id TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE sessions SET last_seen_at = NOW() WHERE id = p_id;
END;
$$;


-- ============================================================
-- 6. Stats daily: refresh + backfill
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
-- 7. Stats page RPCs (read from stats_daily)
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

CREATE OR REPLACE FUNCTION get_stats_visitors(
  since TIMESTAMPTZ DEFAULT NOW() - INTERVAL '90 days'
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result JSON;
  effective_since DATE;
BEGIN
  SELECT GREATEST(since::DATE, COALESCE(MIN(day), CURRENT_DATE))
  INTO effective_since
  FROM stats_daily;

  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.day), '[]'::json)
  INTO result
  FROM (
    SELECT
      d.day::DATE AS day,
      COALESCE(sd.visitors, 0) AS visitors,
      COALESCE(sd.views, 0) AS views
    FROM generate_series(
      effective_since,
      CURRENT_DATE,
      '1 day'::INTERVAL
    ) AS d(day)
    LEFT JOIN stats_daily sd ON sd.day = d.day::DATE
    ORDER BY d.day
  ) t;
  RETURN result;
END;
$$;

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


-- ============================================================
-- 8. Live / heatmap RPCs (read from raw tables)
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
