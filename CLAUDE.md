# TSRM Project - Claude Code Notes

## Deployment

### Production Server

- **Host**: `129.153.65.234` / `tsrm.sasquatchvc.com` (SSH alias: `tsrm-prod`)
- **User**: `ubuntu`
- **SSH key**: `~/.ssh/tsrm_prod` (configured in `~/.ssh/config` as `Host tsrm-prod`)
- **App directory**: `~/app/` (git clone of this repo)
- **Website directory**: `~/app/website/`
- **Process manager**: PM2 (process name: `tsrm`)
- **Supabase**: Local instance at `http://127.0.0.1:54321` on the server (project dir: `~/supabase/`)
- **PostgreSQL**: Port `54322` on the server, user `postgres`, password `postgres`
- **Nginx**: Reverse proxy with Let's Encrypt SSL on `tsrm.sasquatchvc.com`
- **Static images**: Served directly by Nginx from `~/app/website/public/images/`

### Deploy steps

```bash
# 1. Commit and push changes locally
git add <files> && git commit -m "message" && git push origin main

# 2. Pull on production server
ssh tsrm-prod "cd ~/app && git pull origin main"

# 3. Build the Next.js app
ssh tsrm-prod "cd ~/app/website && npm run build"

# 4. Restart the PM2 process
ssh tsrm-prod "pm2 restart tsrm"
```

### Post-deploy SEO smoke test
```bash
bash scripts/seo_check.sh            # against production
bash scripts/seo_check.sh http://localhost:3000   # against a local `next start`
```
Checks status codes, titles/canonicals, H1s, OCR transcript, next/image WebP optimizer, sitemap and robots.

### Notify search engines after a content deploy
```bash
python scripts/indexnow.py    # pushes every sitemap URL to IndexNow (Bing, Yandex, DuckDuckGo, Seznam, Naver)
```
Google ignores IndexNow — resubmit `/sitemap.xml` in Search Console instead. The IndexNow key is the 32-hex `website/public/<key>.txt` file.

### Quick one-liner deploy
```bash
ssh tsrm-prod "cd ~/app && git pull origin main && cd website && npm run build && pm2 restart tsrm"
```

### Run SQL on production database
```bash
ssh tsrm-prod "cd ~/app && PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f scripts/some_file.sql"
```

### Check production logs
```bash
ssh tsrm-prod "pm2 logs tsrm --lines 50"
```

## Project Structure

- `scripts/` - Python crawlers, processors, and ingestion scripts
- `website/` - Next.js frontend with Supabase FTS search
- `data/` - Crawled and processed data (gitignored)
- `claude_code_api/` - Custom Claude API client package

## Key Patterns

- **Claude API import**: `sys.path.insert(0, str(Path(__file__).resolve().parent.parent))` then `from claude_code_api import AsyncClaudeClient`
- **Supabase search**: ILIKE substring matching via `hybrid_search` RPC function

## Manual Data Pipeline

Standard pipeline for processing TSRM manual content (applies to both MK2 and MK3):

### 1. Crawl pages from source
```bash
python scripts/crawler.py --model mk2 --all
```
Downloads GIF scans to `data/{model}/raw/{section}/`.

### 2. Extract text with OCR
```bash
python scripts/processor.py --model mk2 --all
```
Uses Claude Sonnet vision to extract OCR text from each page. Outputs JSON with `ocr_text` field to `data/{model}/processed/{section}/`.

### 3. Convert GIFs to PNGs
```bash
python scripts/upscaler.py --model mk2 --all
```
Converts raw GIF scans to PNG format in `data/{model}/diagrams/{section}/`.

### 4. Generate website content
```bash
python scripts/generate_content.py --model mk2 --all
```
Copies processed JSON to `website/src/content/{model}/` and images to `website/public/images/{model}/`. Builds sections index and search index.

### 5. Ingest to Supabase for search
```bash
python scripts/ingest_to_supabase.py --model mk2
```
Upserts page content into `manual_pages` table for search.

### 6. Build download archives
```bash
python scripts/build_downloads.py --all
```
Generates per-model ZIP files with all images and an offline HTML viewer. Output: `website/public/downloads/*.zip` + `manifest.json`. Only needs to run when content changes (new images processed), not on every deploy. ZIP files are gitignored (~1-2 GB each).

### 7. Deploy
```bash
ssh tsrm-prod "cd ~/app && git pull origin main && cd website && npm run build && pm2 restart tsrm"
```

### How the website displays pages
- Pages with `ocr_text` (and no `content` array): Shows the full page scan image with hidden OCR text for search/SEO
- Pages with structured `content` array: Renders individual content blocks (text, diagrams, tables, etc.)
- Both MK2 and MK3 use the OCR approach (full page images)

## Forum Fixes Pipeline

Pipeline for extracting community repair knowledge from SupraForums.com MKIII subforum:

### 1. Crawl forum threads
```bash
python scripts/forum_crawler.py                    # Full crawl
python scripts/forum_crawler.py --max-pages 3      # Test with 3 pages
python scripts/forum_crawler.py --resume            # Resume interrupted crawl
```
Uses Playwright (headless Chromium) to bypass Tollbit bot protection. Saves raw thread JSON to `data/forum/raw/`.

### 2. Triage threads for confirmed fixes
```bash
python scripts/forum_triage.py                     # Triage all
python scripts/forum_triage.py --max 20            # Test with 20 threads
```
Uses Claude Sonnet to classify threads: does it contain a confirmed fix? Saves to `data/forum/triaged/`.

### 3. Extract structured fix cards
```bash
python scripts/forum_extract.py                    # Extract all qualifying
python scripts/forum_extract.py --max 10           # Test with 10 threads
```
Uses Claude Opus for high-quality extraction of problem, root cause, fix steps, parts, tools, difficulty. Saves to `data/forum/extracted/`.

### 4. Ingest to Supabase
```bash
python scripts/forum_ingest.py                     # Ingest all extracted fixes
python scripts/forum_ingest.py --dry-run           # Preview without writing
```
Upserts fix cards into `forum_fixes` table.

### 5. Database setup (first time only)
```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f scripts/forum_setup.sql
```
Creates `forum_fixes` table, indexes, RLS, and `search_fixes`/`get_fix_category_counts` RPCs.

### Website: Community Fixes tab
- Route: `/{model}/fixes/` (browse) and `/{model}/fixes/{thread_id}` (detail)
- Currently MK3 only (other models 404 on fixes route)
- DocumentTabs component provides navigation between Repair Manual, Wiring Diagrams, and Community Fixes
- Data served from Supabase `forum_fixes` table via `search_fixes` RPC

## Fresh Server Setup

To set up a new server from scratch:

### 1. Install Supabase
Follow the [Supabase self-hosting guide](https://supabase.com/docs/guides/self-hosting) to get a local instance running (API on port 54321, PostgreSQL on port 54322).

### 2. Run the database setup
```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f scripts/setup.sql
```
This creates all tables (`manual_pages`, `page_views`, `sessions`, `stats_daily`, `forum_fixes`), indexes, RLS policies, and RPC functions in one shot.

### 3. Clone the repo and install dependencies
```bash
git clone <repo-url> ~/app
cd ~/app/website && npm install
```

### 4. Run the data pipeline
Follow the [Manual Data Pipeline](#manual-data-pipeline) steps 1-5 to crawl, process, and ingest content.

### 5. Build and start
```bash
cd ~/app/website && npm run build
pm2 start npm --name tsrm -- start
```
