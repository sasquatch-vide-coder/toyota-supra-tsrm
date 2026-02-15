-- Supabase setup for TSRM Hybrid Search
-- Run this SQL in the Supabase SQL Editor (supabase.com dashboard)

-- 1a. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 1b. Create manual_pages table (one row per manual page)
CREATE TABLE manual_pages (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
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
  embedding      VECTOR(1536),  -- NULL until embeddings are generated
  UNIQUE(section, page)
);

CREATE INDEX idx_manual_pages_fts ON manual_pages USING GIN(fts);
CREATE INDEX idx_manual_pages_embedding ON manual_pages
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 30);

-- 1c. Create faqs table
CREATE TABLE faqs (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question       TEXT NOT NULL,
  answer         TEXT NOT NULL,
  section        TEXT NOT NULL,
  page           INT NOT NULL,
  section_name   TEXT NOT NULL DEFAULT '',
  category       TEXT NOT NULL DEFAULT 'general',
  fts            TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', question), 'A') ||
    setweight(to_tsvector('english', answer), 'B')
  ) STORED,
  embedding      VECTOR(1536)  -- NULL until embeddings are generated
);

CREATE INDEX idx_faqs_fts ON faqs USING GIN(fts);
CREATE INDEX idx_faqs_embedding ON faqs
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20);

-- 1d. Row Level Security — allow public read access
ALTER TABLE manual_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON manual_pages FOR SELECT USING (true);

ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read" ON faqs FOR SELECT USING (true);

-- 1e. hybrid_search RPC function — handles null embeddings (FTS-only mode)
CREATE OR REPLACE FUNCTION hybrid_search(
  query_text TEXT,
  query_embedding VECTOR(1536) DEFAULT NULL,
  match_count INT DEFAULT 20,
  fts_weight FLOAT DEFAULT 0.5,
  semantic_weight FLOAT DEFAULT 0.5,
  rrf_k INT DEFAULT 60
)
RETURNS TABLE (
  id BIGINT, section TEXT, page INT, title TEXT, section_header TEXT,
  section_name TEXT, content_text TEXT, score FLOAT, match_type TEXT
) LANGUAGE plpgsql AS $$
BEGIN
  IF query_embedding IS NULL THEN
    -- FTS-only mode
    RETURN QUERY
    SELECT mp.id, mp.section, mp.page, mp.title, mp.section_header,
      mp.section_name, LEFT(mp.content_text, 300),
      ts_rank_cd(mp.fts, websearch_to_tsquery('english', query_text))::FLOAT AS score,
      'fts'::TEXT AS match_type
    FROM manual_pages mp
    WHERE mp.fts @@ websearch_to_tsquery('english', query_text)
    ORDER BY score DESC
    LIMIT match_count;
  ELSE
    -- Hybrid mode: FTS + semantic with RRF
    RETURN QUERY
    WITH fts_results AS (
      SELECT mp.id,
        ROW_NUMBER() OVER (ORDER BY ts_rank_cd(mp.fts, websearch_to_tsquery('english', query_text)) DESC) AS rank_ix
      FROM manual_pages mp
      WHERE mp.fts @@ websearch_to_tsquery('english', query_text)
      LIMIT match_count * 2
    ),
    semantic_results AS (
      SELECT mp.id,
        ROW_NUMBER() OVER (ORDER BY mp.embedding <=> query_embedding) AS rank_ix
      FROM manual_pages mp
      WHERE mp.embedding IS NOT NULL
      ORDER BY mp.embedding <=> query_embedding
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
    SELECT mp.id, mp.section, mp.page, mp.title, mp.section_header,
      mp.section_name, LEFT(mp.content_text, 300), c.combined_score, c.match_type
    FROM combined c
    JOIN manual_pages mp ON mp.id = c.id
    ORDER BY c.combined_score DESC
    LIMIT match_count;
  END IF;
END; $$;

-- 1f. search_faqs RPC function — also handles null embeddings
CREATE OR REPLACE FUNCTION search_faqs(
  query_text TEXT,
  query_embedding VECTOR(1536) DEFAULT NULL,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id BIGINT, question TEXT, answer TEXT, section TEXT, page INT,
  section_name TEXT, category TEXT, score FLOAT
) LANGUAGE plpgsql AS $$
BEGIN
  IF query_embedding IS NULL THEN
    -- FTS-only mode
    RETURN QUERY
    SELECT f.id, f.question, f.answer, f.section, f.page,
      f.section_name, f.category,
      ts_rank_cd(f.fts, websearch_to_tsquery('english', query_text))::FLOAT AS score
    FROM faqs f
    WHERE f.fts @@ websearch_to_tsquery('english', query_text)
    ORDER BY score DESC
    LIMIT match_count;
  ELSE
    -- Hybrid mode
    RETURN QUERY
    WITH fts_results AS (
      SELECT f.id,
        ROW_NUMBER() OVER (ORDER BY ts_rank_cd(f.fts, websearch_to_tsquery('english', query_text)) DESC) AS rank_ix
      FROM faqs f
      WHERE f.fts @@ websearch_to_tsquery('english', query_text)
      LIMIT match_count * 2
    ),
    semantic_results AS (
      SELECT f.id,
        ROW_NUMBER() OVER (ORDER BY f.embedding <=> query_embedding) AS rank_ix
      FROM faqs f
      WHERE f.embedding IS NOT NULL
      ORDER BY f.embedding <=> query_embedding
      LIMIT match_count * 2
    ),
    combined AS (
      SELECT COALESCE(ft.id, se.id) AS id,
        COALESCE(0.4 / (60 + ft.rank_ix), 0.0) +
        COALESCE(0.6 / (60 + se.rank_ix), 0.0) AS combined_score
      FROM fts_results ft
      FULL OUTER JOIN semantic_results se ON ft.id = se.id
    )
    SELECT fq.id, fq.question, fq.answer, fq.section, fq.page,
      fq.section_name, fq.category, c.combined_score
    FROM combined c
    JOIN faqs fq ON fq.id = c.id
    ORDER BY c.combined_score DESC
    LIMIT match_count;
  END IF;
END; $$;
