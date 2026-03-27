"""Parallel forum crawler - runs multiple browser instances across page ranges."""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import threading
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

ROOT_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
FORUM_RAW_DIR = ROOT_DATA_DIR / "forum" / "raw"
THREAD_INDEX_FILE = ROOT_DATA_DIR / "forum" / "thread_index.json"
CHECKPOINT_DIR = ROOT_DATA_DIR / "forum" / "checkpoints"
ERRORS_LOG = ROOT_DATA_DIR / "errors.log"

FORUM_URL = "https://www.supraforums.com/forums/mkiii-1986-5-1992.13/"
REQUEST_DELAY = 2.0
NAV_TIMEOUT = 60000

# Thread-safe lock for writing shared files
_index_lock = threading.Lock()
_log_lock = threading.Lock()


def log_info(worker: int, msg: str) -> None:
    with _log_lock:
        print(f"[W{worker} {time.strftime('%H:%M:%S')}] {msg}")


def log_error(worker: int, msg: str) -> None:
    with _log_lock:
        ERRORS_LOG.parent.mkdir(parents=True, exist_ok=True)
        with open(ERRORS_LOG, "a", encoding="utf-8") as f:
            f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} [forum_crawl_W{worker}] {msg}\n")
        print(f"[W{worker}] ERROR: {msg}", file=sys.stderr)


def load_worker_checkpoint(worker_id: int) -> dict:
    """Load checkpoint for a specific worker."""
    path = CHECKPOINT_DIR / f"worker_{worker_id}.json"
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"last_discovered_page": 0, "discovered_thread_ids": [], "crawled_thread_ids": []}


def save_worker_checkpoint(worker_id: int, checkpoint: dict) -> None:
    """Save checkpoint for a specific worker."""
    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
    path = CHECKPOINT_DIR / f"worker_{worker_id}.json"
    path.write_text(json.dumps(checkpoint, indent=2) + "\n", encoding="utf-8")


def extract_thread_id(url: str) -> str | None:
    match = re.search(r"/threads/[^/]*\.(\d+)/?", url)
    return match.group(1) if match else None


def create_browser(pw):
    browser = pw.chromium.launch(
        headless=False,
        args=["--disable-blink-features=AutomationControlled"],
    )
    ctx = browser.new_context(
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/131.0.0.0 Safari/537.36"
        ),
        viewport={"width": 1920, "height": 1080},
        locale="en-US",
    )
    page = ctx.new_page()
    page.add_init_script(
        'Object.defineProperty(navigator, "webdriver", {get: () => undefined})'
    )
    return browser, page


def navigate(page, url: str, retries: int = 3) -> bool:
    for attempt in range(retries):
        try:
            page.goto(url, timeout=NAV_TIMEOUT, wait_until="load")
            page.wait_for_timeout(3000)
            return True
        except Exception:
            if attempt < retries - 1:
                time.sleep(2 ** (attempt + 1))
    return False


def get_max_page(page) -> int:
    try:
        nav_links = page.query_selector_all(".pageNav a, .pageNav span")
        for el in nav_links:
            text = (el.inner_text() or "").strip()
            match = re.match(r"\d+\s+of\s+(\d[\d,]*)", text)
            if match:
                return int(match.group(1).replace(",", ""))
        max_p = 1
        for link in page.query_selector_all(".pageNav a[href*='page-']"):
            href = link.get_attribute("href") or ""
            m = re.search(r"page-(\d+)", href)
            if m:
                max_p = max(max_p, int(m.group(1)))
        return max_p
    except Exception:
        return 1


def discover_threads_on_page(page) -> list[dict]:
    threads = []
    for el in page.query_selector_all(".structItem"):
        try:
            if el.query_selector('[qid="thread-item-sticky"]'):
                continue
            title_link = el.query_selector('a[qid="thread-item-title"]')
            if not title_link:
                title_link = el.query_selector(".structItem-title a[href*='/threads/']")
            if not title_link:
                continue
            title = (title_link.inner_text() or "").strip()
            href = title_link.get_attribute("href") or ""
            if href.startswith("/"):
                href = "https://www.supraforums.com" + href
            thread_id = extract_thread_id(href)
            if not thread_id:
                continue
            author = el.get_attribute("data-author") or ""
            date_str = ""
            time_el = el.query_selector("time[datetime]")
            if time_el:
                raw_dt = time_el.get_attribute("datetime") or ""
                dm = re.match(r"(\d{4}-\d{2}-\d{2})", raw_dt)
                if dm:
                    date_str = dm.group(1)
            threads.append({
                "thread_id": thread_id, "title": title, "url": href,
                "author": author, "date": date_str, "reply_count": 0,
            })
        except Exception:
            continue
    return threads


def extract_posts(page) -> list[dict]:
    posts = []
    for el in page.query_selector_all("article[data-author]"):
        try:
            author = el.get_attribute("data-author") or ""
            date_str = ""
            time_el = el.query_selector("time[datetime]")
            if time_el:
                raw_dt = time_el.get_attribute("datetime") or ""
                dm = re.match(r"(\d{4}-\d{2}-\d{2})", raw_dt)
                if dm:
                    date_str = dm.group(1)
            post_number = 0
            num_el = el.query_selector("a[href*='/post-']")
            if num_el:
                num_text = (num_el.inner_text() or "").strip().lstrip("#")
                if num_text.replace(",", "").isdigit():
                    post_number = int(num_text.replace(",", ""))
            content = ""
            body_el = el.query_selector(".bbWrapper")
            if body_el:
                try:
                    body_el.evaluate("""el => {
                        el.querySelectorAll('blockquote, .bbCodeBlock--quote, .quote').forEach(q => q.remove());
                    }""")
                except Exception:
                    pass
                content = (body_el.inner_text() or "").strip()
                content = re.sub(r"\n{3,}", "\n\n", content)
            if content or author:
                posts.append({"post_number": post_number, "author": author, "date": date_str, "content": content})
        except Exception:
            continue
    return posts


def save_thread(thread_data: dict) -> None:
    FORUM_RAW_DIR.mkdir(parents=True, exist_ok=True)
    dest = FORUM_RAW_DIR / f"{thread_data['thread_id']}.json"
    dest.write_text(json.dumps(thread_data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def append_to_index(threads: list[dict]) -> None:
    with _index_lock:
        existing = []
        if THREAD_INDEX_FILE.exists():
            existing = json.loads(THREAD_INDEX_FILE.read_text(encoding="utf-8"))
        seen = {t["thread_id"] for t in existing}
        for t in threads:
            if t["thread_id"] not in seen:
                existing.append(t)
                seen.add(t["thread_id"])
        THREAD_INDEX_FILE.parent.mkdir(parents=True, exist_ok=True)
        THREAD_INDEX_FILE.write_text(json.dumps(existing, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def already_crawled(thread_id: str) -> bool:
    return (FORUM_RAW_DIR / f"{thread_id}.json").exists()


def crawl_page_range(worker_id: int, start_page: int, end_page: int, discover_only: bool = False) -> dict:
    """Crawl a range of subforum pages with checkpoint/resume. Returns stats dict."""
    from playwright.sync_api import sync_playwright

    stats = {"threads_found": 0, "threads_crawled": 0, "posts": 0, "errors": 0}
    ckpt = load_worker_checkpoint(worker_id)

    with sync_playwright() as pw:
        browser, page = create_browser(pw)
        log_info(worker_id, f"Browser started, pages {start_page}-{end_page}")

        if ckpt["last_discovered_page"] >= end_page:
            log_info(worker_id, f"Discovery already complete (checkpoint at page {ckpt['last_discovered_page']})")
        else:
            resume_page = max(start_page, ckpt["last_discovered_page"] + 1)
            if resume_page > start_page:
                log_info(worker_id, f"Resuming discovery from page {resume_page} (checkpoint)")

        try:
            all_threads = []

            # Phase 1: Discover threads on assigned pages (with resume)
            resume_page = max(start_page, ckpt["last_discovered_page"] + 1)
            # Load previously discovered threads from checkpoint
            already_discovered = set(ckpt.get("discovered_thread_ids", []))

            for pg in range(resume_page, end_page + 1):
                url = f"{FORUM_URL}page-{pg}" if pg > 1 else FORUM_URL
                if not navigate(page, url):
                    log_error(worker_id, f"Failed to load page {pg}")
                    stats["errors"] += 1
                    continue

                page_threads = discover_threads_on_page(page)
                new_threads = [t for t in page_threads if t["thread_id"] not in already_discovered]
                all_threads.extend(new_threads)
                for t in new_threads:
                    already_discovered.add(t["thread_id"])

                log_info(worker_id, f"Page {pg}/{end_page}: {len(page_threads)} threads ({len(new_threads)} new)")

                # Save checkpoint after each page
                ckpt["last_discovered_page"] = pg
                ckpt["discovered_thread_ids"] = list(already_discovered)
                save_worker_checkpoint(worker_id, ckpt)

                if pg < end_page:
                    time.sleep(REQUEST_DELAY)

            stats["threads_found"] = len(already_discovered)
            append_to_index(all_threads)

            if discover_only:
                log_info(worker_id, f"Discovery done: {len(already_discovered)} threads")
                return stats

            # Phase 2: Crawl each thread (skip already-crawled)
            crawled_set = set(ckpt.get("crawled_thread_ids", []))
            all_discovered = list(already_discovered)
            pending = [tid for tid in all_discovered
                       if tid not in crawled_set and not already_crawled(tid)]

            # We need thread metadata to crawl - load from index
            index_threads = {}
            if THREAD_INDEX_FILE.exists():
                for t in json.loads(THREAD_INDEX_FILE.read_text(encoding="utf-8")):
                    index_threads[t["thread_id"]] = t

            pending_with_meta = [(tid, index_threads[tid]) for tid in pending if tid in index_threads]
            skipped = len(all_discovered) - len(pending_with_meta) - len(crawled_set)
            log_info(worker_id, f"Crawling {len(pending_with_meta)} threads "
                     f"({len(crawled_set)} checkpointed, {skipped} already on disk)")

            for i, (tid, thread_meta) in enumerate(pending_with_meta):
                if not navigate(page, thread_meta["url"]):
                    log_error(worker_id, f"Failed to load thread {tid}")
                    stats["errors"] += 1
                    continue

                total_pages = get_max_page(page)
                all_posts = extract_posts(page)

                for tp in range(2, total_pages + 1):
                    time.sleep(REQUEST_DELAY)
                    pg_url = f"{thread_meta['url']}page-{tp}"
                    if navigate(page, pg_url):
                        all_posts.extend(extract_posts(page))

                for j, post in enumerate(all_posts, 1):
                    if post["post_number"] == 0:
                        post["post_number"] = j

                thread_data = {
                    "thread_id": tid,
                    "title": thread_meta["title"],
                    "url": thread_meta["url"],
                    "author": thread_meta.get("author", ""),
                    "date": thread_meta.get("date", ""),
                    "reply_count": len(all_posts),
                    "posts": all_posts,
                }
                save_thread(thread_data)
                stats["threads_crawled"] += 1
                stats["posts"] += len(all_posts)

                # Update checkpoint after each thread
                crawled_set.add(tid)
                ckpt["crawled_thread_ids"] = list(crawled_set)
                save_worker_checkpoint(worker_id, ckpt)

                if (i + 1) % 10 == 0 or i == len(pending_with_meta) - 1:
                    log_info(worker_id, f"  Progress: {i + 1}/{len(pending_with_meta)} threads, {stats['posts']} posts")

                time.sleep(REQUEST_DELAY)

        except KeyboardInterrupt:
            log_info(worker_id, "Interrupted! Checkpoint saved.")
            save_worker_checkpoint(worker_id, ckpt)
        except Exception as e:
            log_error(worker_id, f"Unexpected error: {e}")
            save_worker_checkpoint(worker_id, ckpt)
            stats["errors"] += 1
        finally:
            browser.close()
            log_info(worker_id, f"Done: {stats['threads_crawled']} threads, {stats['posts']} posts")

    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description="Parallel forum crawler with checkpoint/resume")
    parser.add_argument("--workers", type=int, default=4, help="Number of parallel browser instances (default: 4)")
    parser.add_argument("--max-pages", type=int, default=None, help="Limit total subforum pages to crawl")
    parser.add_argument("--discover-only", action="store_true", help="Only discover threads, don't fetch content")
    parser.add_argument("--resume", action="store_true",
                        help="Resume from checkpoints. Uses same page ranges as previous run. "
                             "Workers skip already-discovered pages and already-crawled threads.")
    parser.add_argument("--reset", action="store_true", help="Clear all checkpoints before starting")
    args = parser.parse_args()

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Install Playwright: pip install playwright && playwright install chromium", file=sys.stderr)
        sys.exit(1)

    if args.reset:
        import shutil
        if CHECKPOINT_DIR.exists():
            shutil.rmtree(CHECKPOINT_DIR)
            print("Checkpoints cleared.")

    # Check for saved page ranges from previous run (for --resume)
    ranges_file = CHECKPOINT_DIR / "ranges.json"
    if args.resume and ranges_file.exists():
        saved = json.loads(ranges_file.read_text(encoding="utf-8"))
        ranges = [(r["worker"], r["start"], r["end"]) for r in saved["ranges"]]
        total_pages = saved["total_pages"]
        print(f"Resuming previous crawl: {total_pages} pages, {len(ranges)} workers")
        print(f"Page ranges: {[(s, e) for _, s, e in ranges]}")

        # Show checkpoint status for each worker
        for wid, start, end in ranges:
            ckpt = load_worker_checkpoint(wid)
            disc = ckpt.get("last_discovered_page", 0)
            crawled = len(ckpt.get("crawled_thread_ids", []))
            print(f"  Worker {wid}: discovered to page {disc}/{end}, crawled {crawled} threads")
        print()
    else:
        # First, determine total pages
        print("Detecting total pages...")
        with sync_playwright() as pw:
            browser, page = create_browser(pw)
            if not navigate(page, FORUM_URL):
                print("Failed to load forum index!", file=sys.stderr)
                browser.close()
                sys.exit(1)
            total_pages = get_max_page(page)
            browser.close()

        if args.max_pages:
            total_pages = min(total_pages, args.max_pages)

        print(f"Total pages: {total_pages}, Workers: {args.workers}")

        # Split pages across workers
        FORUM_RAW_DIR.mkdir(parents=True, exist_ok=True)
        pages_per_worker = max(1, total_pages // args.workers)
        ranges = []
        for i in range(args.workers):
            start = i * pages_per_worker + 1
            end = (i + 1) * pages_per_worker if i < args.workers - 1 else total_pages
            if start <= total_pages:
                ranges.append((i, start, end))

        # Save ranges for resume
        CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
        ranges_file.write_text(json.dumps({
            "total_pages": total_pages,
            "ranges": [{"worker": w, "start": s, "end": e} for w, s, e in ranges],
        }, indent=2) + "\n", encoding="utf-8")

        print(f"Page ranges: {[(s, e) for _, s, e in ranges]}")
        print()

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {
            executor.submit(crawl_page_range, wid, start, end, args.discover_only): wid
            for wid, start, end in ranges
        }
        total_stats = {"threads_found": 0, "threads_crawled": 0, "posts": 0, "errors": 0}
        for future in as_completed(futures):
            wid = futures[future]
            try:
                stats = future.result()
                for k in total_stats:
                    total_stats[k] += stats[k]
            except Exception as e:
                print(f"Worker {wid} failed: {e}")

    print(f"\n=== CRAWL COMPLETE ===")
    print(f"Threads found: {total_stats['threads_found']}")
    print(f"Threads crawled: {total_stats['threads_crawled']}")
    print(f"Total posts: {total_stats['posts']}")
    print(f"Errors: {total_stats['errors']}")


if __name__ == "__main__":
    main()
