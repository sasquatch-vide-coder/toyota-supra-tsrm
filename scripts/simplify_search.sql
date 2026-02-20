-- Replace hybrid_search with plain ILIKE substring matching.
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
