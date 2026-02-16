-- Supabase setup for TSRM FTS Search
-- Run this SQL in the Supabase SQL Editor (supabase.com dashboard)

-- 1a. Create manual_pages table (one row per manual page)
CREATE TABLE manual_pages (
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

CREATE INDEX idx_manual_pages_fts ON manual_pages USING GIN(fts);

-- 1b. Create faqs table
CREATE TABLE faqs (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  model          TEXT NOT NULL DEFAULT 'mk3',
  question       TEXT NOT NULL,
  answer         TEXT NOT NULL,
  section        TEXT NOT NULL,
  page           INT NOT NULL,
  section_name   TEXT NOT NULL DEFAULT '',
  category       TEXT NOT NULL DEFAULT 'general',
  fts            TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', question), 'A') ||
    setweight(to_tsvector('english', answer), 'B')
  ) STORED
);

CREATE INDEX idx_faqs_fts ON faqs USING GIN(fts);

-- 1c. Row Level Security — allow public read access
ALTER TABLE manual_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON manual_pages FOR SELECT USING (true);

ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON faqs FOR SELECT USING (true);

-- 1d. hybrid_search RPC function — FTS-only with model filter
CREATE OR REPLACE FUNCTION hybrid_search(
  query_text TEXT,
  match_count INT DEFAULT 20,
  filter_model TEXT DEFAULT 'mk3'
)
RETURNS TABLE (
  id BIGINT, section TEXT, page INT, title TEXT, section_header TEXT,
  section_name TEXT, content_text TEXT, score FLOAT, match_type TEXT
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT mp.id, mp.section, mp.page, mp.title, mp.section_header,
    mp.section_name, LEFT(mp.content_text, 300),
    ts_rank_cd(mp.fts, websearch_to_tsquery('english', query_text))::FLOAT AS score,
    'fts'::TEXT AS match_type
  FROM manual_pages mp
  WHERE mp.fts @@ websearch_to_tsquery('english', query_text)
    AND mp.model = filter_model
  ORDER BY score DESC
  LIMIT match_count;
END; $$;

-- 1e. search_faqs RPC function — FTS-only with model filter
CREATE OR REPLACE FUNCTION search_faqs(
  query_text TEXT,
  match_count INT DEFAULT 5,
  filter_model TEXT DEFAULT 'mk3'
)
RETURNS TABLE (
  id BIGINT, question TEXT, answer TEXT, section TEXT, page INT,
  section_name TEXT, category TEXT, score FLOAT
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT f.id, f.question, f.answer, f.section, f.page,
    f.section_name, f.category,
    ts_rank_cd(f.fts, websearch_to_tsquery('english', query_text))::FLOAT AS score
  FROM faqs f
  WHERE f.fts @@ websearch_to_tsquery('english', query_text)
    AND f.model = filter_model
  ORDER BY score DESC
  LIMIT match_count;
END; $$;
