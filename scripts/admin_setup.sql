-- Admin dashboard schema: page_views, sessions, RPCs

-- page_views: individual events
CREATE TABLE page_views (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id    TEXT NOT NULL,
  path          TEXT NOT NULL CHECK (char_length(path) <= 500),
  referrer      TEXT CHECK (referrer IS NULL OR char_length(referrer) <= 2000),
  user_agent    TEXT,
  screen_width  INT,
  screen_height INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_pv_created ON page_views (created_at DESC);
CREATE INDEX idx_pv_session ON page_views (session_id);
CREATE INDEX idx_pv_path ON page_views (path);

-- sessions: session-level aggregation
CREATE TABLE sessions (
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
CREATE INDEX idx_sess_last ON sessions (last_seen_at DESC);
CREATE INDEX idx_sess_start ON sessions (started_at DESC);

-- RLS
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert" ON page_views FOR INSERT WITH CHECK (true);
CREATE POLICY "service_read" ON page_views FOR SELECT USING (true);
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_all" ON sessions USING (true);

-- RPC: upsert session on each pageview
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

-- RPC: heartbeat (updates last_seen without incrementing page_count)
CREATE OR REPLACE FUNCTION heartbeat_session(p_id TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE sessions SET last_seen_at = NOW() WHERE id = p_id;
END;
$$;

-- RPC: dashboard metrics
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
