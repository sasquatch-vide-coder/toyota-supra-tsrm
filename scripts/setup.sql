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


-- ============================================================
-- 9. Download events table
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


-- ============================================================
-- 10. System metrics table (was section 9)
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
-- 11. System metrics RPC (adaptive aggregation)
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
    SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.recorded_at), '[]'::json)
    INTO result
    FROM (
      SELECT recorded_at, cpu_pct, mem_pct, net_rx_mb, net_tx_mb
      FROM system_metrics
      WHERE recorded_at >= since
    ) t;
  ELSIF hours_span <= 168 THEN
    SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.recorded_at), '[]'::json)
    INTO result
    FROM (
      SELECT
        date_trunc('hour', recorded_at)
          + (EXTRACT(MINUTE FROM recorded_at)::INT / 15) * INTERVAL '15 minutes'
          AS recorded_at,
        ROUND(AVG(cpu_pct)::NUMERIC, 1)::REAL AS cpu_pct,
        ROUND(AVG(mem_pct)::NUMERIC, 1)::REAL AS mem_pct,
        ROUND(SUM(net_rx_mb)::NUMERIC, 3)::REAL AS net_rx_mb,
        ROUND(SUM(net_tx_mb)::NUMERIC, 3)::REAL AS net_tx_mb
      FROM system_metrics
      WHERE recorded_at >= since
      GROUP BY 1
    ) t;
  ELSE
    SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.recorded_at), '[]'::json)
    INTO result
    FROM (
      SELECT
        date_trunc('hour', recorded_at) AS recorded_at,
        ROUND(AVG(cpu_pct)::NUMERIC, 1)::REAL AS cpu_pct,
        ROUND(AVG(mem_pct)::NUMERIC, 1)::REAL AS mem_pct,
        ROUND(SUM(net_rx_mb)::NUMERIC, 3)::REAL AS net_rx_mb,
        ROUND(SUM(net_tx_mb)::NUMERIC, 3)::REAL AS net_tx_mb
      FROM system_metrics
      WHERE recorded_at >= since
      GROUP BY 1
    ) t;
  END IF;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_system_metrics()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM system_metrics WHERE recorded_at < NOW() - INTERVAL '90 days';
END;
$$;


-- ============================================================
-- 12. Forum fixes (community-sourced repair solutions)
-- ============================================================

CREATE TABLE IF NOT EXISTS forum_fixes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id text UNIQUE NOT NULL,
  model text NOT NULL DEFAULT 'mk3',
  source_urls text[] NOT NULL,
  title text NOT NULL,
  category text NOT NULL,
  subcategory text,
  problem_description text NOT NULL,
  symptoms text[] DEFAULT '{}',
  root_cause text,
  fix_summary text NOT NULL,
  fix_steps text[] DEFAULT '{}',
  parts_needed text[] DEFAULT '{}',
  tools_needed text[] DEFAULT '{}',
  difficulty text NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  estimated_time text,
  confidence float NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  confirmation_type text NOT NULL CHECK (confirmation_type IN ('op_confirmed', 'community_consensus')),
  thread_date date,
  fts tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(problem_description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(fix_summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(root_cause, '')), 'C')
  ) STORED,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forum_fixes_fts ON forum_fixes USING GIN (fts);
CREATE INDEX IF NOT EXISTS idx_forum_fixes_category ON forum_fixes (category);
CREATE INDEX IF NOT EXISTS idx_forum_fixes_model ON forum_fixes (model);

ALTER TABLE forum_fixes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'forum_fixes' AND policyname = 'forum_fixes_read') THEN
    CREATE POLICY "forum_fixes_read" ON forum_fixes FOR SELECT USING (true);
  END IF;
END $$;


-- ============================================================
-- 13. Forum fixes search + browse RPC
-- ============================================================

CREATE OR REPLACE FUNCTION search_fixes(
  search_query text DEFAULT '',
  filter_model text DEFAULT NULL,
  filter_category text DEFAULT NULL,
  sort_by text DEFAULT 'confidence',
  result_limit int DEFAULT 20,
  result_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  thread_id text,
  model text,
  source_urls text[],
  title text,
  category text,
  subcategory text,
  problem_description text,
  symptoms text[],
  root_cause text,
  fix_summary text,
  fix_steps text[],
  parts_needed text[],
  tools_needed text[],
  difficulty text,
  estimated_time text,
  confidence float,
  confirmation_type text,
  thread_date date,
  rank float,
  total_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id, f.thread_id, f.model, f.source_urls, f.title,
    f.category, f.subcategory, f.problem_description, f.symptoms,
    f.root_cause, f.fix_summary, f.fix_steps, f.parts_needed,
    f.tools_needed, f.difficulty, f.estimated_time,
    f.confidence, f.confirmation_type, f.thread_date,
    CASE WHEN search_query = '' THEN 0.0
         ELSE ts_rank(f.fts, websearch_to_tsquery('english', search_query))
    END AS rank,
    COUNT(*) OVER() AS total_count
  FROM forum_fixes f
  WHERE
    (search_query = '' OR f.fts @@ websearch_to_tsquery('english', search_query))
    AND (filter_model IS NULL OR f.model = filter_model)
    AND (filter_category IS NULL OR f.category = filter_category)
  ORDER BY
    CASE WHEN sort_by = 'relevance' AND search_query != '' THEN ts_rank(f.fts, websearch_to_tsquery('english', search_query)) END DESC NULLS LAST,
    CASE WHEN sort_by = 'confidence' OR (sort_by = 'relevance' AND search_query = '') THEN f.confidence END DESC NULLS LAST,
    CASE WHEN sort_by = 'newest' THEN f.thread_date END DESC NULLS LAST,
    CASE WHEN sort_by = 'category' THEN f.category END ASC NULLS LAST,
    f.confidence DESC
  LIMIT result_limit
  OFFSET result_offset;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 14. Forum fixes category counts RPC
-- ============================================================

CREATE OR REPLACE FUNCTION get_fix_category_counts(
  filter_model text DEFAULT NULL
)
RETURNS TABLE (
  category text,
  fix_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT f.category, COUNT(*) AS fix_count
  FROM forum_fixes f
  WHERE (filter_model IS NULL OR f.model = filter_model)
  GROUP BY f.category
  ORDER BY fix_count DESC;
END;
$$ LANGUAGE plpgsql;
