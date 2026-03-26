-- Forum fixes migration - run on existing deployments
--
-- Usage:
--   PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f scripts/forum_setup.sql


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
    setweight(to_tsvector('english', coalesce(root_cause, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(array_to_string(symptoms, ' '), '')), 'C')
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
