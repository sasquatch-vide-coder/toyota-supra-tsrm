-- Migration: Remove embeddings, add model column, simplify to FTS-only search
-- Run on production: ssh tsrm "cd ~/app && PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f scripts/migrate_fts_only.sql"

BEGIN;

-- 1. Drop embedding indexes
DROP INDEX IF EXISTS idx_manual_pages_embedding;
DROP INDEX IF EXISTS idx_faqs_embedding;
DROP INDEX IF EXISTS idx_forum_threads_embedding;

-- 2. Drop embedding columns
ALTER TABLE manual_pages DROP COLUMN IF EXISTS embedding;
ALTER TABLE faqs DROP COLUMN IF EXISTS embedding;
ALTER TABLE forum_threads DROP COLUMN IF EXISTS embedding;

-- 3. Add model column to manual_pages (default 'mk3' for existing data)
ALTER TABLE manual_pages ADD COLUMN IF NOT EXISTS model TEXT NOT NULL DEFAULT 'mk3';

-- 4. Drop old unique constraint and create new one with model
ALTER TABLE manual_pages DROP CONSTRAINT IF EXISTS manual_pages_section_page_key;
ALTER TABLE manual_pages ADD CONSTRAINT manual_pages_model_section_page_key UNIQUE (model, section, page);

-- 5. Add model column to faqs (default 'mk3' for existing data)
ALTER TABLE faqs ADD COLUMN IF NOT EXISTS model TEXT NOT NULL DEFAULT 'mk3';

-- 6. Replace hybrid_search with FTS-only + model filter
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

-- 7. Replace search_faqs with FTS-only + model filter
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

-- 8. Replace search_forum_threads with FTS-only (no model column on forum)
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

COMMIT;
