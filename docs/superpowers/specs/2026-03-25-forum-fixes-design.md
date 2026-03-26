# Community Fixes - Forum Knowledge Base

## Context

The TSRM site currently serves factory service manual content (TSRM + EWD) for MK2/MK3/MK4 Supras. Users frequently need real-world repair knowledge that goes beyond what the factory manual provides - confirmed fixes for common issues, diagnostic tips, and practical repair steps refined by the community over decades.

SupraForums.com's MKIII subforum contains thousands of threads with repair discussions, but this knowledge is buried in unstructured forum conversations mixed with unanswered questions, speculation, and noise. This project crawls that forum, uses AI to extract only confirmed fixes, and surfaces them as structured, searchable fix cards in a new "Community Fixes" tab on the website.

**Scope**: MK3 only for now. Other models return 404 for the fixes route.

## Source

- **Forum**: SupraForums.com, MKIII (1986.5-1992) subforum
- **URL**: `https://www.supraforums.com/forums/mkiii-1986-5-1992.13/`
- **Platform**: XenForo (based on URL patterns)
- **Bot protection**: Tollbit (402 paywall for automated requests)
- **Scope**: One-time crawl of existing backlog. Re-crawling can be added later.

## Architecture Overview

```
Crawl (Playwright) -> Triage (Sonnet) -> Extract (Opus) -> Ingest (Supabase) -> Display (Next.js)
```

Four-stage pipeline: browser-automated crawling, AI triage to filter quality threads, AI extraction to produce structured fix cards, and database ingestion for search and display.

## Stage 1: Crawler

**Script**: `scripts/forum_crawler.py`
**Technology**: Playwright (headless Chromium)

Playwright renders pages as a real browser, bypassing Tollbit's bot detection. Polite 2-3 second delays between requests.

**Process**:
1. Navigate to MKIII subforum, paginate through all thread listing pages
2. Collect all thread URLs, titles, reply counts, dates
3. For each thread: load all pages, extract all posts (author, date, content, post number)
4. Save each thread as JSON to `data/forum/raw/{thread_id}.json`
5. Maintain a checkpoint file (`data/forum/crawl_checkpoint.json`) tracking per-thread status for resume support

**Error handling**:
- Retry failed page loads up to 3 times with exponential backoff
- Log and skip threads that are locked/deleted/moved
- If navigation times out, save checkpoint and exit gracefully (resume on next run)
- 60-second Playwright navigation timeout per page

**Long threads**: Threads may span many pages. The crawler loads all pages of each thread and concatenates posts. No truncation at the crawl stage.

**Raw thread JSON schema**:
```json
{
  "thread_id": "string",
  "title": "string",
  "url": "string",
  "author": "string",
  "date": "ISO date string",
  "reply_count": "number",
  "posts": [
    {
      "post_number": "number",
      "author": "string",
      "date": "ISO date string",
      "content": "string (HTML stripped to text)"
    }
  ]
}
```

## Stage 2: AI Triage

**Script**: `scripts/forum_triage.py`
**Model**: Claude Sonnet

Filters threads to identify those containing confirmed fixes. A "confirmed fix" is defined as either:
- The original poster came back and confirmed a solution worked
- Multiple knowledgeable community members agreed on the solution

**Process**:
1. Read each raw thread JSON
2. Send thread content to Sonnet with classification prompt
3. Save result to `data/forum/triaged/{thread_id}.json`
4. Threads with `has_fix: true` and `confidence >= 0.7` proceed to extraction

**Long thread handling**: For threads exceeding ~150 posts, truncate to the first 20 posts + last 30 posts (resolutions tend to be near the end). Include a note in the prompt that the middle was omitted.

**Triage output schema**:
```json
{
  "thread_id": "string",
  "has_fix": "boolean",
  "confidence": "number (0-1)",
  "reason": "string (brief explanation)"
}
```

## Stage 3: AI Extraction

**Script**: `scripts/forum_extract.py`
**Model**: Claude Opus

Produces structured fix cards from qualifying threads. Opus is used here for its superior ability to follow complex multi-post conversations and produce accurate technical documentation.

**Process**:
1. Read qualifying thread JSONs (passed triage)
2. Send to Opus with detailed extraction prompt
3. Save structured fix card to `data/forum/extracted/{thread_id}.json`

**Deduplication**: After all threads are extracted, run a deduplication pass. Group fix cards by category + similarity of problem description (using Opus to compare). When multiple threads describe the same fix, merge into a single card keeping the best/most complete information and listing all source thread URLs. The merged card's `thread_id` is set to the oldest thread's ID (canonical ID for the URL).

**Long thread handling**: Same truncation strategy as triage (first 20 + last 30 posts for threads over 150 posts).

**Fix card JSON schema**:
```json
{
  "thread_id": "string",
  "source_urls": ["string (one or more if merged from duplicates)"],
  "title": "string",
  "model": "mk3",
  "category": "string (Engine, Turbo, Electrical, Fuel System, Cooling, Transmission, Suspension, Brakes, Body/Interior, Exhaust)",
  "subcategory": "string (more specific grouping)",
  "problem": {
    "description": "string",
    "symptoms": ["string"]
  },
  "root_cause": "string",
  "fix": {
    "summary": "string",
    "steps": ["string"],
    "parts_needed": ["string or empty"],
    "tools_needed": ["string or empty"],
    "difficulty": "beginner | intermediate | advanced",
    "estimated_time": "string"
  },
  "confidence": "number (0-1)",
  "confirmation_type": "op_confirmed | community_consensus",
  "thread_date": "ISO date string"
}
```

**Categories** (AI-assigned from content, guided by these common groupings):
Engine, Turbo, Electrical, Fuel System, Cooling, Transmission, Suspension, Brakes, Body/Interior, Exhaust

## Stage 4: Database

**Table**: `forum_fixes` in Supabase (PostgreSQL)

**SQL DDL** (to be added to `scripts/setup.sql`):

```sql
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
CREATE POLICY "Allow public read access" ON forum_fixes FOR SELECT USING (true);

-- Search/browse RPC function with sort and total count
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

-- Category counts RPC for sidebar
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
```

All columns use native PostgreSQL types (`text[]`) for consistency and better FTS/array operation support.

**Ingestion script**: `scripts/forum_ingest.py` - reads extracted fix JSONs and upserts into `forum_fixes` table.

## Stage 5: Website

### Navigation: Document type switcher

Currently there is no explicit UI for switching between TSRM/EWD - users navigate by URL. Adding a third document type makes this untenable. A **document type switcher** needs to be added to the topbar area of each document layout.

**New component**: `DocumentTabs.tsx` (client component) - a horizontal tab row rendered in the topbar of each layout (TSRM, EWD, and fixes). Shows all available document types for the current model with the active one highlighted.

```
[Repair Manual]  [Wiring Diagrams]  [Community Fixes]
```

- **Client component** using `usePathname()` to determine the active tab
- Receives `documents` and `model` as props from the parent server layout (each layout calls `getDocuments(model)` server-side and passes the result down)
- Maps document types to routes: `manual` -> `/[model]/tsrm`, `ewd` -> `/[model]/ewd`, `fixes` -> `/[model]/fixes`
- Active tab styled with cyan bottom border and neon text (matching sidebar active state)
- Inactive tabs in muted text
- Compact styling: Space Grotesk, 12px, uppercase, 0.1em letter-spacing

This component is added to the topbar div in all three layout files (tsrm/layout.tsx, ewd/layout.tsx, fixes/layout.tsx).

### DocumentDef extension

Update `website/src/lib/documents.ts`:

1. Add `"fixes"` to the `DocumentDef.type` union: `type: "manual" | "ewd" | "fixes"`
2. Add fixes to MK3 config in `MODEL_DOCUMENTS`:
   ```typescript
   {
     type: "fixes",
     label: "Community Fixes",
     description: "Verified repairs from SupraForums",
     contentDir: "forum",
   }
   ```
3. Update `getDocuments()` to handle the `"fixes"` type. The fixes type doesn't use `loadSections()` - it checks for fix data existence differently (e.g., check if `website/src/content/forum/fixes-index.json` exists, or just hardcode that fixes are available for mk3).

### Routes and layout

```
/(manual)/[model]/fixes/                -> Browse/search all fixes
/(manual)/[model]/fixes/[thread_id]/    -> Individual fix detail page
```

**New layout**: `website/src/app/(manual)/[model]/fixes/layout.tsx`

Unlike TSRM/EWD layouts which have a V1Sidebar with section navigation, the fixes layout uses a different structure:
- **Topbar**: Same pattern as TSRM/EWD (`TSRM / {modelName} / Community Fixes`) + DocumentTabs + search button
- **No V1Sidebar**: The fixes browse page has its own category sidebar built into the page component, not the layout
- **Layout body**: Simple flex container for the page content, no persistent sidebar

The fixes route returns 404 for models other than mk3 (check in layout or page).

**Empty state**: When no fixes exist in the database for the current model, show a centered message: "No community fixes available yet" with muted text styling.

### Model redirect update

Update `website/src/app/(manual)/[model]/page.tsx` to redirect to the first available document type for each model (instead of hardcoding `/tsrm`). Use `getDocuments(model)` and map the first result's type to its route (`manual` -> `tsrm`, `ewd` -> `ewd`, `fixes` -> `fixes`). This also fixes a pre-existing issue where MK4 redirects to `/mk4/tsrm` which has no content.

### Browse page (`/fixes/page.tsx`)

Server component that fetches fix data from Supabase.

- **Header**: Title + fix count
- **Search bar**: Client-side search input that navigates to search results or filters in-place
- **Category sidebar**: Left sidebar with category list + counts, filter on click
- **Fix card grid**: Cards as shown in mockup (title, badges, symptoms, problem snippet, fix summary, metadata)
- **Sort options**: Confidence (default), Newest, Category
- **Pagination**: Server-side, 20 fixes per page, simple prev/next navigation at bottom

### Detail page (`/fixes/[thread_id]/page.tsx`)

Server component that fetches a single fix from Supabase by thread_id.

- **Back link**: "Back to fixes" returning to browse page
- **Problem section**: Description + symptom tags
- **Root cause section**: Highlighted in coral/tertiary color
- **Fix steps**: Numbered steps with cyan step indicators
- **Parts & tools**: Side-by-side info cards
- **Difficulty & time**: Side-by-side info cards
- **Confidence indicator**: Visual bar with description text
- **Source link**: "View Original Thread" linking to SupraForums (one or more links if merged from duplicates)

### Search API

**New route**: `/api/search/fixes/route.ts` (separate from existing `/api/search`)

Calls the `search_fixes` RPC function. Query params: `q` (search text), `model`, `category`, `limit`, `offset`.

Returns JSON array of fix objects with a `rank` field for relevance ordering.

The existing SearchDialog is not reused - the fixes browse page has its own inline search that queries this API.

### Styling

All components follow the existing Kinetic Tokyo design system:
- Dark surfaces (#0e0e13 base)
- Cyan (#00f1fd) for active states, step numbers, links
- Purple (#de8eff) for category badges, gradient accents
- Coral (#ff6e81) for advanced difficulty, root cause highlights
- Space Grotesk for headings/labels, Manrope for body text
- 2px border-radius, ghost watermarks, neon glow effects

### Files to create/modify

**New files**:
- `scripts/forum_crawler.py` - Playwright-based forum crawler
- `scripts/forum_triage.py` - Sonnet triage pass
- `scripts/forum_extract.py` - Opus extraction pass
- `scripts/forum_ingest.py` - Supabase ingestion
- `scripts/forum_setup.sql` - Standalone migration script for forum_fixes table + RPCs (also appended to setup.sql for fresh installs)
- `website/src/app/(manual)/[model]/fixes/layout.tsx` - Fixes layout
- `website/src/app/(manual)/[model]/fixes/page.tsx` - Browse page
- `website/src/app/(manual)/[model]/fixes/[thread_id]/page.tsx` - Detail page
- `website/src/components/DocumentTabs.tsx` - Document type switcher
- `website/src/components/FixCard.tsx` - Fix card component
- `website/src/components/FixDetail.tsx` - Fix detail component
- `website/src/app/api/search/fixes/route.ts` - Search API

**Modified files**:
- `website/src/lib/documents.ts` - Add fixes type + update getDocuments()
- `website/src/app/(manual)/[model]/tsrm/layout.tsx` - Add DocumentTabs
- `website/src/app/(manual)/[model]/ewd/layout.tsx` - Add DocumentTabs
- `website/src/app/(manual)/[model]/page.tsx` - Handle fixes redirect for mk3
- `scripts/setup.sql` - Add forum_fixes table DDL
- `CLAUDE.md` - Document forum pipeline

## Verification

1. **Crawler**: Run on first 2-3 pages of thread listings (~60 threads). Verify JSON output, checkpoint file, and resume support.
2. **Triage**: Process 20 raw threads manually. Verify has_fix classification by reading the actual threads.
3. **Extraction**: Process 10 triaged threads. Review fix card quality - are the steps accurate? Is the difficulty reasonable? Is the root cause correct?
4. **Deduplication**: Check extracted fixes for near-duplicates. Verify merge produces clean combined cards.
5. **Database**: Run `forum_setup.sql`, ingest test data, verify FTS queries: `SELECT * FROM search_fixes('rough idle', 'mk3')` returns relevant results.
6. **Website browse**: Page loads, category sidebar filters work, sort changes order, pagination works, cards display all fields.
7. **Website detail**: Fix detail page renders all sections correctly, source link works.
8. **Document tabs**: Tab switcher appears on all three layouts, highlights the active document type, links work.
9. **Non-MK3 models**: Verify `/mk2/fixes/` and `/mk4/fixes/` return 404.
10. **End-to-end**: Search for "rough idle" on the fixes browse page and verify results match expected fixes.
