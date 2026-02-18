# SupraForums Crawler & Search Integration

## Context

The TSRM project is a digitized 1990 Toyota Supra MK3 repair manual with hybrid search (FTS + semantic embeddings via Supabase/pgvector). The user wants to crawl the SupraForums MKIII subforum (https://www.supraforums.com/forums/mkiii-1986-5-1992.13/) to index community-reported issues and fixes, making them searchable alongside the existing manual pages and FAQs. Each result links back to the original forum thread.

**Approach**: Start with a small scraping test (3-5 threads) to validate feasibility, then build the full pipeline following existing project patterns.

**Claude API**: All AI processing uses the `claude_code_api` package already present at `D:\Coding\tsrm\claude_code_api\` (copied from `D:\Coding\claude-code-api`). Imported via `sys.path.insert(0, str(Path(__file__).resolve().parent.parent))` which adds the project root to the path, as done in existing scripts (see `scripts/generate_faqs.py:18-24`, `scripts/processor.py:15-20`).

---

## Phase 0: Project Setup

### Create `plan.md` in project root
- Copy of this plan for ongoing reference during implementation

### Create `task.md` in project root
- Checklist of all tasks organized by phase, to mark off as completed

---

## Phase 1: Scraping Test (Priority)

### 1.1 Modify `requirements.txt`
- Add `beautifulsoup4>=4.12`

### 1.2 Modify `.gitignore`
- Add `data/forum/` line (after existing `data/processed/` entry at line 8)

### 1.3 Create `scripts/forum_crawler.py`

Follow the pattern of `scripts/crawler.py` (httpx, rate limiting, resume, argparse, error logging).

**Constants & imports** (reuse patterns from `scripts/crawler.py:1-21`):
- `FORUM_URL = "https://www.supraforums.com/forums/mkiii-1986-5-1992.13/"`
- `FORUM_RAW_DIR = DATA_DIR / "forum" / "raw"`
- `FORUM_INDEX_FILE = DATA_DIR / "forum" / "thread_index.json"`
- `REQUEST_DELAY = 1.5` (slightly slower than the manual crawler's 0.5 to be respectful)
- `USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) TSRM-Bot/1.0"`
- Use `httpx.Client(timeout=30, follow_redirects=True, headers={"User-Agent": USER_AGENT})`

**Data classes**:
- `ThreadMeta`: thread_id, title, url, author, date_posted (ISO 8601), reply_count, view_count, is_sticky
- `Post`: author, date, content (cleaned text), post_number
- `ThreadData`: meta (ThreadMeta) + posts (list[Post])

**Thread listing parsing** (`parse_thread_listing(html) -> list[ThreadMeta]`):
- Use `BeautifulSoup(html, "html.parser")`
- XenForo 2 selectors:
  - Each thread: `div.structItem--thread`
  - Title/URL: `.structItem-title a` (skip `.labelLink` prefix links)
  - Author: `.username` in `.structItem-cell--main`
  - Date: `time[datetime]` attribute in `.structItem-cell--latest`
  - Reply/view counts: `.pairs.pairs--justified dd` elements
  - Sticky detection: `.structItem--sticky` class
- Pagination: `a.pageNav-jump--next` href for next page

**Thread content parsing** (`parse_thread_posts(html) -> list[Post]`):
- Each post: `article.message`
- Author: `data-author` attribute
- Date: `time[datetime]` in `.message-attribution-main`
- Body: `.message-body .bbWrapper` - strip HTML tags, keep text + newlines
- Handle multi-page threads via same pagination pattern

**Output format** (`data/forum/raw/{thread_id}.json`):
```json
{
  "meta": { "thread_id": "12345", "title": "...", "url": "...", "author": "...", "date_posted": "...", "reply_count": 23, "view_count": 1502, "is_sticky": false },
  "posts": [{ "author": "...", "date": "...", "content": "...", "post_number": 1 }],
  "crawled_at": "2026-02-15T12:00:00Z"
}
```

**Thread index** (`data/forum/thread_index.json`): Array of all ThreadMeta objects for quick reference.

**CLI flags** (argparse, pattern from `scripts/crawler.py:158-164`):
- `--test`: Only fetch 3-5 threads for validation
- `--max-pages N`: Max listing pages to crawl (default: 3)
- `--thread URL`: Fetch a single thread by URL
- `--force`: Re-download existing threads
- `--list-only`: Only fetch thread listing, don't download thread content
- `--skip-sticky`: Skip sticky/pinned threads

**Resume support**: Skip if `FORUM_RAW_DIR / f"{thread_id}.json"` exists (unless `--force`), same pattern as `scripts/crawler.py:99-101`.

**Error logging**: Reuse `log_error()` pattern from `scripts/crawler.py:24-28`, writing to `data/errors.log`.

**JS fallback detection**: After fetching the listing page, check if any `.structItem--thread` elements exist. If not, print a warning suggesting the site may require a headless browser (Playwright), and exit gracefully.

### 1.4 Verify Phase 1
- Run `python scripts/forum_crawler.py --test`
- Confirm 3-5 JSON files appear in `data/forum/raw/`
- Confirm each has meta fields + posts with actual text content
- If httpx fails (JS-only), evaluate Playwright fallback

---

## Phase 2: AI Processing

### 2.1 Create `scripts/forum_processor.py`

**Claude API usage** - follows `scripts/generate_faqs.py` exactly:
```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from claude_code_api import AsyncClaudeClient, OverloadedError, RateLimitError
```

This adds the project root (`D:\Coding\tsrm`) to sys.path where `claude_code_api/` lives. Identical to `scripts/generate_faqs.py:18-20`.

**Model**: `claude-sonnet-4-5-20250929` (same as `scripts/generate_faqs.py:35`)
**Max tokens**: 2048
**Concurrency**: `asyncio.Semaphore(5)` - moderate, between processor.py's 3 and generate_faqs.py's 10

**Retry logic** (copy from `scripts/generate_faqs.py:165-185`):
- Catch `RateLimitError`: wait `e.retry_after or (5 * 2**retries)` seconds, max 60s
- Catch `OverloadedError`: wait 30s
- Max 3 retries

**Claude prompt** (`FORUM_EXTRACT_PROMPT`):
```
You are analyzing a forum thread from SupraForums.com about the 1986.5-1992 Toyota Supra (MK3/A70).

Thread title: {title}
Thread URL: {url}
Number of replies: {reply_count}

Thread content (all posts):
{thread_text}

Extract structured data from this thread. Output ONLY valid JSON:
{
  "issue_summary": "Brief 1-2 sentence summary of the main issue discussed",
  "symptoms": ["symptom 1", "symptom 2"],
  "fix_summary": "Brief summary of the fix/solution, or empty string if unresolved",
  "related_systems": ["Engine", "Cooling"],
  "parts_mentioned": ["head gasket", "thermostat"],
  "thread_type": "troubleshooting|modification|general_discussion|how_to|parts_question",
  "is_resolved": true,
  "key_takeaway": "One-sentence summary of the most useful information"
}
```

**Thread text preparation** (`build_thread_text(thread_data) -> str`):
- Concatenate all posts as `"[Post #{n} by {author}]\n{content}\n\n"`
- Truncate to ~8000 chars total
- Prioritize: first post always included, then posts containing keywords like "solution", "fix", "fixed", "resolved", "figured it out"

**JSON response parsing**: Reuse `parse_faq_response()` pattern from `scripts/generate_faqs.py:130-146` (strip markdown fences, json.loads, validate structure)

**Output** (`data/forum/processed/{thread_id}.json`):
- Copy all meta fields from raw JSON
- Add extracted fields: issue_summary, symptoms, fix_summary, related_systems, parts_mentioned, thread_type, is_resolved, key_takeaway
- Build `searchable_text`: concatenation of title + issue_summary + " ".join(symptoms) + fix_summary + key_takeaway + " ".join(parts_mentioned)

**CLI** (argparse): `--all`, `--thread THREAD_ID`, `--force`, `--retry`

### 2.2 Verify Phase 2
- Run `python scripts/forum_processor.py --all`
- Check processed JSON files for quality of extraction
- Verify issue/fix summaries are accurate and useful

---

## Phase 3: Database & Ingestion

### 3.1 Create `scripts/forum_supabase_setup.sql`

Follow `scripts/supabase_setup.sql` patterns exactly.

### 3.2 Create `scripts/forum_ingest.py`

Follow `scripts/ingest_to_supabase.py` pattern exactly.

### 3.3 Verify Phase 3
- Run SQL in Supabase dashboard
- Run `python scripts/forum_ingest.py --with-embeddings`
- Verify rows in forum_threads table
- Test RPC: `SELECT * FROM search_forum_threads('head gasket')`

---

## Phase 4: Search Integration (Frontend)

### 4.1 Modify `website/src/types.ts`
### 4.2 Modify `website/src/app/api/search/route.ts`
### 4.3 Modify `website/src/components/SearchDialog.tsx`
### 4.4 Verify Phase 4
