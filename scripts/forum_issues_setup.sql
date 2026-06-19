-- Community Issues schema (replaces the old forum_fixes fix-card model)
--
-- The new model groups confirmed-fix threads into distinct ISSUES; each issue
-- links to the source threads where it was confirmed fixed. No authored repair
-- content -- the forum threads remain the source of truth.
--
-- Usage:
--   PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f scripts/forum_issues_setup.sql

-- ------------------------------------------------------------
-- Remove the old fix-card model (data + RPCs)
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS search_fixes(text, text, text, text, int, int);
DROP FUNCTION IF EXISTS get_fix_category_counts(text);
DROP TABLE IF EXISTS forum_fixes CASCADE;

-- ------------------------------------------------------------
-- forum_issues
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS forum_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  model text NOT NULL DEFAULT 'mk3',
  system text NOT NULL,
  issue text NOT NULL,
  thread_count int NOT NULL DEFAULT 0,
  -- [{thread_id, title, url, issue_label, confidence, post_count}, ...]
  threads jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- issue text + all member thread titles/labels, for full-text search
  search_text text NOT NULL DEFAULT '',
  fts tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(issue, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(search_text, '')), 'B')
  ) STORED,
  created_at timestamptz DEFAULT now(),
  UNIQUE (model, slug)
);

CREATE INDEX IF NOT EXISTS idx_forum_issues_fts ON forum_issues USING GIN (fts);
CREATE INDEX IF NOT EXISTS idx_forum_issues_system ON forum_issues (system);
CREATE INDEX IF NOT EXISTS idx_forum_issues_model ON forum_issues (model);

ALTER TABLE forum_issues ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'forum_issues' AND policyname = 'forum_issues_read') THEN
    CREATE POLICY "forum_issues_read" ON forum_issues FOR SELECT USING (true);
  END IF;
END $$;

-- ------------------------------------------------------------
-- search_issues: browse + full-text search
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION search_issues(
  search_query text DEFAULT '',
  filter_model text DEFAULT NULL,
  filter_system text DEFAULT NULL,
  sort_by text DEFAULT 'threads',
  result_limit int DEFAULT 20,
  result_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  slug text,
  model text,
  system text,
  issue text,
  thread_count int,
  threads jsonb,
  rank double precision,
  total_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id, f.slug, f.model, f.system, f.issue, f.thread_count, f.threads,
    CASE WHEN search_query = '' THEN 0.0::double precision
         ELSE ts_rank(f.fts, websearch_to_tsquery('english', search_query))
    END AS rank,
    COUNT(*) OVER() AS total_count
  FROM forum_issues f
  WHERE
    (search_query = '' OR f.fts @@ websearch_to_tsquery('english', search_query))
    AND (filter_model IS NULL OR f.model = filter_model)
    AND (filter_system IS NULL OR f.system = filter_system)
  ORDER BY
    CASE WHEN sort_by = 'relevance' AND search_query != '' THEN ts_rank(f.fts, websearch_to_tsquery('english', search_query)) END DESC NULLS LAST,
    CASE WHEN sort_by = 'threads' OR (sort_by = 'relevance' AND search_query = '') THEN f.thread_count END DESC NULLS LAST,
    CASE WHEN sort_by = 'system' THEN f.system END ASC NULLS LAST,
    f.thread_count DESC
  LIMIT result_limit
  OFFSET result_offset;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- get_issue_system_counts: sidebar counts
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_issue_system_counts(
  filter_model text DEFAULT NULL
)
RETURNS TABLE (
  system text,
  issue_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT f.system, COUNT(*) AS issue_count
  FROM forum_issues f
  WHERE (filter_model IS NULL OR f.model = filter_model)
  GROUP BY f.system
  ORDER BY issue_count DESC;
END;
$$ LANGUAGE plpgsql;
