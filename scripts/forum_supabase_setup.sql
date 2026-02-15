-- Supabase setup for SupraForums thread search
-- Run this SQL in the Supabase SQL Editor (supabase.com dashboard)
-- Prerequisite: vector extension already enabled by supabase_setup.sql

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
  ) STORED,
  embedding       VECTOR(1536)
);

-- 2b. Indexes
CREATE INDEX idx_forum_threads_fts ON forum_threads USING GIN(fts);
CREATE INDEX idx_forum_threads_embedding ON forum_threads
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

-- 2c. Row Level Security
ALTER TABLE forum_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON forum_threads FOR SELECT USING (true);

-- 2d. search_forum_threads RPC — hybrid search with RRF, handles null embeddings
CREATE OR REPLACE FUNCTION search_forum_threads(
  query_text TEXT,
  query_embedding VECTOR(1536) DEFAULT NULL,
  match_count INT DEFAULT 10,
  fts_weight FLOAT DEFAULT 0.5,
  semantic_weight FLOAT DEFAULT 0.5,
  rrf_k INT DEFAULT 60
)
RETURNS TABLE (
  id BIGINT, thread_id TEXT, title TEXT, url TEXT, author TEXT,
  date_posted TIMESTAMPTZ, reply_count INT, issue_summary TEXT,
  fix_summary TEXT, key_takeaway TEXT, related_systems TEXT[],
  parts_mentioned TEXT[], thread_type TEXT, is_resolved BOOLEAN,
  score FLOAT, match_type TEXT
) LANGUAGE plpgsql AS $$
BEGIN
  IF query_embedding IS NULL THEN
    -- FTS-only mode
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
  ELSE
    -- Hybrid mode: FTS + semantic with RRF
    RETURN QUERY
    WITH fts_results AS (
      SELECT ft.id,
        ROW_NUMBER() OVER (ORDER BY ts_rank_cd(ft.fts, websearch_to_tsquery('english', query_text)) DESC) AS rank_ix
      FROM forum_threads ft
      WHERE ft.fts @@ websearch_to_tsquery('english', query_text)
      LIMIT match_count * 2
    ),
    semantic_results AS (
      SELECT ft.id,
        ROW_NUMBER() OVER (ORDER BY ft.embedding <=> query_embedding) AS rank_ix
      FROM forum_threads ft
      WHERE ft.embedding IS NOT NULL
      ORDER BY ft.embedding <=> query_embedding
      LIMIT match_count * 2
    ),
    combined AS (
      SELECT COALESCE(f.id, s.id) AS id,
        COALESCE(fts_weight / (rrf_k + f.rank_ix), 0.0) +
        COALESCE(semantic_weight / (rrf_k + s.rank_ix), 0.0) AS combined_score,
        CASE WHEN f.id IS NOT NULL AND s.id IS NOT NULL THEN 'both'
             WHEN f.id IS NOT NULL THEN 'fts' ELSE 'semantic' END AS match_type
      FROM fts_results f
      FULL OUTER JOIN semantic_results s ON f.id = s.id
    )
    SELECT ft.id, ft.thread_id, ft.title, ft.url, ft.author,
      ft.date_posted, ft.reply_count, ft.issue_summary,
      ft.fix_summary, ft.key_takeaway, ft.related_systems,
      ft.parts_mentioned, ft.thread_type, ft.is_resolved,
      c.combined_score, c.match_type
    FROM combined c
    JOIN forum_threads ft ON ft.id = c.id
    ORDER BY c.combined_score DESC
    LIMIT match_count;
  END IF;
END; $$;
