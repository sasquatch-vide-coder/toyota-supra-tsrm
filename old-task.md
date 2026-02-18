# SupraForums Crawler & Search Integration - Task Checklist

## Phase 0: Project Setup
- [x] Create `plan.md` in project root
- [x] Create `task.md` in project root

## Phase 1: Scraping Test
- [x] Add `beautifulsoup4>=4.12` to `requirements.txt`
- [x] Add `data/forum/` to `.gitignore`
- [x] Create `scripts/forum_crawler.py`
- [ ] Verify: Run `python scripts/forum_crawler.py --test` and confirm JSON output

## Phase 2: AI Processing
- [x] Create `scripts/forum_processor.py`
- [ ] Verify: Run `python scripts/forum_processor.py --all` and check output quality

## Phase 3: Database & Ingestion
- [x] Create `scripts/forum_supabase_setup.sql`
- [x] Create `scripts/forum_ingest.py`
- [ ] Verify: Run SQL in Supabase, run ingest script, test RPC

## Phase 4: Search Integration (Frontend)
- [x] Modify `website/src/types.ts` (add ForumResult, update SearchResponse)
- [x] Modify `website/src/app/api/search/route.ts` (forum search + source filter)
- [x] Modify `website/src/components/SearchDialog.tsx` (forum results + filter pills)
- [ ] Verify: Run dev server and test search with forum results
