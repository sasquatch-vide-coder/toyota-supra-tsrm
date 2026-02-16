# TSRM Project - Claude Code Notes

## Deployment

The production server is defined in `.env`:
- **Host**: `10.13.37.10` (SSH alias: `tsrm`)
- **User**: `supratsrm`
- **SSH key**: `~/.ssh/tsrm_server` (configured in `~/.ssh/config` as `Host tsrm`)
- **App directory**: `~/app/` (git clone of this repo)
- **Website directory**: `~/app/website/`
- **Process manager**: PM2 (process name: `tsrm`)
- **Supabase**: Local instance at `http://127.0.0.1:54321` on the server
- **PostgreSQL**: Port `54322` on the server, user `postgres`, password `postgres`

### Deploy steps

```bash
# 1. Commit and push changes locally
git add <files> && git commit -m "message" && git push origin main

# 2. Pull on production server
ssh tsrm "cd ~/app && git pull origin main"

# 3. Build the Next.js app
ssh tsrm "cd ~/app/website && npm run build"

# 4. Restart the PM2 process
ssh tsrm "pm2 restart tsrm"
```

### Quick one-liner deploy
```bash
ssh tsrm "cd ~/app && git pull origin main && cd website && npm run build && pm2 restart tsrm"
```

### Run SQL on production database
```bash
ssh tsrm "cd ~/app && PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f scripts/some_file.sql"
```

Or via Python:
```python
import psycopg2
conn = psycopg2.connect(host="10.13.37.10", port=54322, dbname="postgres", user="postgres", password="postgres")
```

### Check production logs
```bash
ssh tsrm "pm2 logs tsrm --lines 50"
```

## Project Structure

- `scripts/` - Python crawlers, processors, and ingestion scripts
- `website/` - Next.js frontend with Supabase FTS search
- `data/` - Crawled and processed data (gitignored)
- `claude_code_api/` - Custom Claude API client package

## Key Patterns

- **HTTP client for SupraForums**: Must use `curl` subprocess (not httpx/requests) due to TLS fingerprinting returning 409
- **Claude API import**: `sys.path.insert(0, str(Path(__file__).resolve().parent.parent))` then `from claude_code_api import AsyncClaudeClient`
- **Supabase search**: FTS (full-text search) via RPC functions (`hybrid_search`, `search_faqs`, `search_forum_threads`)

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

### 5. Generate FAQs
```bash
python scripts/generate_faqs.py --model mk2
```
Generates FAQ Q&A pairs from content and inserts into Supabase `faqs` table.

### 6. Ingest to Supabase for search
```bash
python scripts/ingest_to_supabase.py --model mk2
```
Upserts page content into `manual_pages` table for FTS search.

### 7. Deploy
```bash
ssh tsrm "cd ~/app && git pull origin main && cd website && npm run build && pm2 restart tsrm"
```

### How the website displays pages
- Pages with `ocr_text` (and no `content` array): Shows the full page scan image with hidden OCR text for search/SEO
- Pages with structured `content` array: Renders individual content blocks (text, diagrams, tables, etc.)
- Both MK2 and MK3 use the OCR approach (full page images)
