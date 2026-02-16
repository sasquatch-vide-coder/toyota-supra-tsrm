-- Supabase setup for SupraForums thread search
-- Run this SQL in the Supabase SQL Editor (supabase.com dashboard)

-- 2a. Create forum_threads table
CREATE TABLE forum_threads (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  thread_id       TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  url             TEXT NOT NULL,
  author          TEXT NOT NULL DEFAULT '',
  date_posted     TIMESTAMPTZ,
  reply_count     INT NOT NULL DEFAULT 0,
  issue_summary   TEXT NOT NULL DEFAULT '',
  symptoms        TEXT[] NOT NULL DEFAULT '{}',
  fix_summary     TEXT NOT NULL DEFAULT '',
  related_systems TEXT[] NOT NULL DEFAULT '{}',
  parts_mentioned TEXT[] NOT NULL DEFAULT '{}',
  thread_type     TEXT NOT NULL DEFAULT 'general_discussion',
  is_resolved     BOOLEAN NOT NULL DEFAULT false,
  key_takeaway    TEXT NOT NULL DEFAULT '',
  searchable_text TEXT NOT NULL DEFAULT '',
  fts             TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(issue_summary, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(fix_summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(key_takeaway, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(searchable_text, '')), 'C')
  ) STORED
);

-- 2b. Indexes
CREATE INDEX idx_forum_threads_fts ON forum_threads USING GIN(fts);

-- 2c. Row Level Security
ALTER TABLE forum_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON forum_threads FOR SELECT USING (true);

-- 2d. search_forum_threads RPC — FTS-only search
CREATE OR REPLACE FUNCTION search_forum_threads(
  query_text TEXT,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id BIGINT, thread_id TEXT, title TEXT, url TEXT, author TEXT,
  date_posted TIMESTAMPTZ, reply_count INT, issue_summary TEXT,
  fix_summary TEXT, key_takeaway TEXT, related_systems TEXT[],
  parts_mentioned TEXT[], thread_type TEXT, is_resolved BOOLEAN,
  score FLOAT, match_type TEXT
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT ft.id, ft.thread_id, ft.title, ft.url, ft.author,
    ft.date_posted, ft.reply_count, ft.issue_summary,
    ft.fix_summary, ft.key_takeaway, ft.related_systems,
    ft.parts_mentioned, ft.thread_type, ft.is_resolved,
    ts_rank_cd(ft.fts, websearch_to_tsquery('english', query_text))::FLOAT AS score,
    'fts'::TEXT AS match_type
  FROM forum_threads ft
  WHERE ft.fts @@ websearch_to_tsquery('english', query_text)
  ORDER BY score DESC
  LIMIT match_count;
END; $$;
