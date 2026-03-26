"""Crawl SupraForums MKIII subforum threads using Playwright."""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path

# Playwright is imported at runtime to give a clear error if not installed

ROOT_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
FORUM_RAW_DIR = ROOT_DATA_DIR / "forum" / "raw"
CHECKPOINT_FILE = ROOT_DATA_DIR / "forum" / "crawl_checkpoint.json"
THREAD_INDEX_FILE = ROOT_DATA_DIR / "forum" / "thread_index.json"
ERRORS_LOG = ROOT_DATA_DIR / "errors.log"

FORUM_URL = "https://www.supraforums.com/forums/mkiii-1986-5-1992.13/"
REQUEST_DELAY = 2.5  # seconds between page loads
NAV_TIMEOUT = 60000  # 60 seconds
MAX_RETRIES = 3


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

def log_error(msg: str) -> None:
    """Append an error to the shared errors log and print to stderr."""
    ERRORS_LOG.parent.mkdir(parents=True, exist_ok=True)
    with open(ERRORS_LOG, "a", encoding="utf-8") as f:
        f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} [forum_crawler] {msg}\n")
    print(f"  ERROR: {msg}", file=sys.stderr)


def log_info(msg: str) -> None:
    """Print an informational message to stdout."""
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")


# ---------------------------------------------------------------------------
# Checkpoint helpers
# ---------------------------------------------------------------------------

def load_checkpoint() -> dict:
    """Load crawl checkpoint from disk, or return defaults."""
    if CHECKPOINT_FILE.exists():
        try:
            return json.loads(CHECKPOINT_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as e:
            log_error(f"Failed to read checkpoint: {e}")
    return {"discovered_pages": 0, "crawled_threads": []}


def save_checkpoint(checkpoint: dict) -> None:
    """Persist crawl checkpoint to disk."""
    CHECKPOINT_FILE.parent.mkdir(parents=True, exist_ok=True)
    CHECKPOINT_FILE.write_text(json.dumps(checkpoint, indent=2) + "\n", encoding="utf-8")


# ---------------------------------------------------------------------------
# Thread index helpers
# ---------------------------------------------------------------------------

def load_thread_index() -> list[dict]:
    """Load the thread index from disk."""
    if THREAD_INDEX_FILE.exists():
        try:
            return json.loads(THREAD_INDEX_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as e:
            log_error(f"Failed to read thread index: {e}")
    return []


def save_thread_index(threads: list[dict]) -> None:
    """Persist the thread index to disk."""
    THREAD_INDEX_FILE.parent.mkdir(parents=True, exist_ok=True)
    THREAD_INDEX_FILE.write_text(json.dumps(threads, indent=2) + "\n", encoding="utf-8")


# ---------------------------------------------------------------------------
# Navigation with retry
# ---------------------------------------------------------------------------

def navigate_with_retry(page, url: str, retries: int = MAX_RETRIES) -> bool:
    """Navigate to a URL with exponential backoff retries.

    Returns True on success, False after all retries exhausted.
    """
    for attempt in range(retries):
        try:
            page.goto(url, timeout=NAV_TIMEOUT, wait_until="load")
            # Give JS-rendered content a moment to settle (networkidle never
            # fires on forums with persistent ad/analytics connections)
            page.wait_for_timeout(3000)
            return True
        except Exception as e:
            backoff = 2 ** (attempt + 1)  # 2s, 4s, 8s
            log_error(f"Navigation failed (attempt {attempt + 1}/{retries}) for {url}: {e}")
            if attempt < retries - 1:
                log_info(f"  Retrying in {backoff}s...")
                time.sleep(backoff)
    return False


# ---------------------------------------------------------------------------
# Thread discovery
# ---------------------------------------------------------------------------

def extract_thread_id(url: str) -> str | None:
    """Extract the numeric thread ID from a XenForo thread URL.

    Example: /threads/some-slug.123456/ -> 123456
    """
    match = re.search(r"/threads/[^/]*\.(\d+)/?", url)
    return match.group(1) if match else None


def discover_threads_on_page(page) -> list[dict]:
    """Extract thread metadata from a single subforum listing page.

    Returns a list of dicts with: url, title, thread_id, author, date, reply_count.
    XenForo selectors may need tweaking depending on the exact site template.
    """
    threads = []

    # SupraForums uses XenForo 2.x with a "California" theme.
    # Each thread row is a .structItem div.
    # Sticky threads contain an <i qid="thread-item-sticky"> inside the title.
    # Non-sticky threads have <a qid="thread-item-title"> as the title link.
    thread_elements = page.query_selector_all(".structItem")

    for el in thread_elements:
        try:
            # Skip sticky threads (identified by qid="thread-item-sticky")
            sticky_indicator = el.query_selector('[qid="thread-item-sticky"]')
            if sticky_indicator:
                continue

            # Title + URL: non-sticky threads use qid="thread-item-title"
            title_link = el.query_selector('a[qid="thread-item-title"]')
            if not title_link:
                # Fallback: any link with /threads/ in href
                title_link = el.query_selector(".structItem-title a[href*='/threads/']")
            if not title_link:
                continue

            title = (title_link.inner_text() or "").strip()
            href = title_link.get_attribute("href") or ""

            # Build absolute URL if relative
            if href.startswith("/"):
                href = "https://www.supraforums.com" + href

            thread_id = extract_thread_id(href)
            if not thread_id:
                continue

            # Author: data-author attribute on the structItem, or qid username link
            author = el.get_attribute("data-author") or ""
            if not author:
                author_el = el.query_selector('[qid="thread-item-username"], .username')
                if author_el:
                    author = (author_el.inner_text() or "").strip()

            # Date: XenForo stores dates in <time> elements with a datetime attr
            date_str = ""
            time_el = el.query_selector("time[datetime]")
            if time_el:
                raw_dt = time_el.get_attribute("datetime") or ""
                # datetime is usually ISO 8601: 2019-03-15T12:00:00+0000
                date_match = re.match(r"(\d{4}-\d{2}-\d{2})", raw_dt)
                if date_match:
                    date_str = date_match.group(1)

            # Reply count: XenForo shows this in the stats area
            reply_count = 0
            # Try the structured pairs (dt/dd) first
            pairs = el.query_selector_all(".pairs--justified dt")
            for dt in pairs:
                label = (dt.inner_text() or "").strip().lower()
                if "replies" in label or "reply" in label:
                    dd = dt.evaluate("el => el.nextElementSibling && el.nextElementSibling.textContent")
                    if dd:
                        count_match = re.search(r"[\d,]+", str(dd))
                        if count_match:
                            reply_count = int(count_match.group().replace(",", ""))
                    break

            # If the pairs approach didn't work, try a broader approach
            if reply_count == 0:
                stats_el = el.query_selector(".structItem-cell--meta")
                if stats_el:
                    stats_text = stats_el.inner_text() or ""
                    # Look for a number near "replies"
                    reply_match = re.search(r"([\d,]+)\s*(?:replies|reply)", stats_text, re.IGNORECASE)
                    if reply_match:
                        reply_count = int(reply_match.group(1).replace(",", ""))

            threads.append({
                "thread_id": thread_id,
                "title": title,
                "url": href,
                "author": author,
                "date": date_str,
                "reply_count": reply_count,
            })

        except Exception as e:
            log_error(f"Failed to parse thread element: {e}")
            continue

    return threads


def get_max_page_number(page) -> int:
    """Determine the last page number from XenForo pagination controls.

    Returns 1 if no pagination is found (single-page listing).
    """
    # XenForo 2.x pagination: .pageNav-page contains page links,
    # the last one (before "next") is the max page number.
    try:
        page_links = page.query_selector_all(".pageNav-page a")
        if not page_links:
            return 1
        max_page = 1
        for link in page_links:
            text = (link.inner_text() or "").strip()
            if text.isdigit():
                max_page = max(max_page, int(text))
        return max_page
    except Exception:
        return 1


def discover_all_threads(
    page,
    checkpoint: dict,
    max_pages: int | None = None,
) -> list[dict]:
    """Paginate through the subforum listing and collect all thread metadata.

    Respects checkpoint['discovered_pages'] for resuming.
    """
    existing_index = load_thread_index()
    seen_ids = {t["thread_id"] for t in existing_index}
    all_threads = list(existing_index)

    start_page = checkpoint.get("discovered_pages", 0) + 1

    # Navigate to the first page to determine total pages
    log_info(f"Navigating to subforum: {FORUM_URL}")
    if not navigate_with_retry(page, FORUM_URL):
        log_error("Failed to load subforum index page")
        return all_threads

    total_pages = get_max_page_number(page)
    log_info(f"Subforum has {total_pages} pages of threads")

    if max_pages is not None:
        total_pages = min(total_pages, max_pages)
        log_info(f"Limiting discovery to {total_pages} pages (--max-pages)")

    for page_num in range(start_page, total_pages + 1):
        if page_num > 1:
            url = f"{FORUM_URL}page-{page_num}"
            log_info(f"Loading subforum page {page_num}/{total_pages}...")
            if not navigate_with_retry(page, url):
                log_error(f"Failed to load subforum page {page_num}, stopping discovery")
                break
        else:
            log_info(f"Processing subforum page 1/{total_pages}...")

        page_threads = discover_threads_on_page(page)
        new_count = 0
        for t in page_threads:
            if t["thread_id"] not in seen_ids:
                seen_ids.add(t["thread_id"])
                all_threads.append(t)
                new_count += 1

        log_info(f"  Found {len(page_threads)} threads ({new_count} new)")

        # Update checkpoint
        checkpoint["discovered_pages"] = page_num
        save_checkpoint(checkpoint)
        save_thread_index(all_threads)

        if page_num < total_pages:
            time.sleep(REQUEST_DELAY)

    log_info(f"Discovery complete: {len(all_threads)} total threads in index")
    return all_threads


# ---------------------------------------------------------------------------
# Thread content extraction
# ---------------------------------------------------------------------------

def extract_posts_from_page(page) -> list[dict]:
    """Extract all posts from a single thread page.

    Returns a list of dicts with: author, date, content, post_number.
    """
    posts = []

    # SupraForums uses XenForo 2.x with California theme.
    # Posts are <article> elements with data-author attributes.
    post_elements = page.query_selector_all("article[data-author]")

    # Fallback selectors
    if not post_elements:
        post_elements = page.query_selector_all("article.message, .message--post")
    if not post_elements:
        post_elements = page.query_selector_all("[data-content='post']")

    for el in post_elements:
        try:
            # Author: from data-author attribute
            author = el.get_attribute("data-author") or ""

            # Date
            date_str = ""
            time_el = el.query_selector("time[datetime]")
            if time_el:
                raw_dt = time_el.get_attribute("datetime") or ""
                date_match = re.match(r"(\d{4}-\d{2}-\d{2})", raw_dt)
                if date_match:
                    date_str = date_match.group(1)

            # Post number: try the #N link or fall back to sequential numbering
            post_number = 0
            num_el = el.query_selector(
                "a[href*='/post-'], .message-attribution-opposite a, "
                ".message-number a"
            )
            if num_el:
                num_text = (num_el.inner_text() or "").strip().lstrip("#")
                if num_text.replace(",", "").isdigit():
                    post_number = int(num_text.replace(",", ""))

            # Content: get .bbWrapper (XenForo's rich text container),
            # stripping blockquotes to reduce quote noise
            content = ""
            body_el = el.query_selector(".bbWrapper")
            if body_el:
                # Remove blockquote elements before extracting text
                # to reduce quote noise
                try:
                    body_el.evaluate("""el => {
                        const quotes = el.querySelectorAll('blockquote, .bbCodeBlock--quote, .quote');
                        quotes.forEach(q => q.remove());
                    }""")
                except Exception:
                    pass  # If JS removal fails, we still get the text

                content = (body_el.inner_text() or "").strip()

            # Clean up content: collapse excessive whitespace
            content = re.sub(r"\n{3,}", "\n\n", content)
            content = content.strip()

            if not content and not author:
                continue  # Skip empty/malformed posts

            posts.append({
                "post_number": post_number,
                "author": author,
                "date": date_str,
                "content": content,
            })

        except Exception as e:
            log_error(f"Failed to parse post element: {e}")
            continue

    return posts


def get_thread_page_count(page) -> int:
    """Determine total pages in a thread from XenForo pagination."""
    return get_max_page_number(page)


def crawl_thread(page, thread_meta: dict) -> dict | None:
    """Crawl all pages of a single thread and return the full thread dict.

    Returns None on failure.
    """
    thread_url = thread_meta["url"]
    thread_id = thread_meta["thread_id"]

    log_info(f"Crawling thread {thread_id}: {thread_meta['title'][:60]}...")

    # Load first page
    if not navigate_with_retry(page, thread_url):
        log_error(f"Failed to load thread {thread_id}: {thread_url}")
        return None

    total_pages = get_thread_page_count(page)
    log_info(f"  Thread has {total_pages} page(s)")

    all_posts: list[dict] = []

    # Extract posts from page 1
    posts = extract_posts_from_page(page)
    all_posts.extend(posts)
    log_info(f"  Page 1: {len(posts)} posts")

    # Crawl remaining pages
    for pg in range(2, total_pages + 1):
        time.sleep(REQUEST_DELAY)
        pg_url = f"{thread_url}page-{pg}"
        log_info(f"  Loading page {pg}/{total_pages}...")

        if not navigate_with_retry(page, pg_url):
            log_error(f"Failed to load thread {thread_id} page {pg}")
            continue

        posts = extract_posts_from_page(page)
        all_posts.extend(posts)
        log_info(f"  Page {pg}: {len(posts)} posts")

    # Assign sequential post numbers if they weren't extracted
    for i, post in enumerate(all_posts, start=1):
        if post["post_number"] == 0:
            post["post_number"] = i

    thread_data = {
        "thread_id": thread_id,
        "title": thread_meta["title"],
        "url": thread_url,
        "author": thread_meta.get("author", ""),
        "date": thread_meta.get("date", ""),
        "reply_count": thread_meta.get("reply_count", 0),
        "posts": all_posts,
    }

    log_info(f"  Done: {len(all_posts)} total posts")
    return thread_data


def save_thread(thread_data: dict) -> None:
    """Save a single thread's data to disk."""
    FORUM_RAW_DIR.mkdir(parents=True, exist_ok=True)
    dest = FORUM_RAW_DIR / f"{thread_data['thread_id']}.json"
    dest.write_text(json.dumps(thread_data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Crawl SupraForums MKIII subforum threads using Playwright",
    )
    parser.add_argument(
        "--discover-only",
        action="store_true",
        help="Only discover threads (build index), don't fetch content",
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=None,
        help="Limit subforum listing pages to crawl (for testing)",
    )
    parser.add_argument(
        "--max-threads",
        type=int,
        default=None,
        help="Limit number of threads to fetch (for testing)",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume from last checkpoint",
    )
    args = parser.parse_args()

    # Import Playwright with a helpful error message
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print(
            "Playwright is required but not installed.\n"
            "Install it with: pip install playwright && playwright install chromium",
            file=sys.stderr,
        )
        sys.exit(1)

    # Load or initialize checkpoint
    if args.resume:
        checkpoint = load_checkpoint()
        log_info(f"Resuming from checkpoint: {checkpoint['discovered_pages']} pages discovered, "
                 f"{len(checkpoint['crawled_threads'])} threads crawled")
    else:
        checkpoint = {"discovered_pages": 0, "crawled_threads": []}

    # Ensure output directories exist
    FORUM_RAW_DIR.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as pw:
        log_info("Launching Chromium...")
        browser = pw.chromium.launch(
            headless=False,
            args=["--disable-blink-features=AutomationControlled"],
        )
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/131.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1920, "height": 1080},
            locale="en-US",
        )
        page = context.new_page()
        page.add_init_script(
            'Object.defineProperty(navigator, "webdriver", {get: () => undefined})'
        )

        try:
            # Phase 1: Thread discovery
            log_info("=== Phase 1: Thread Discovery ===")
            thread_index = discover_all_threads(page, checkpoint, max_pages=args.max_pages)

            if not thread_index:
                log_info("No threads found. Exiting.")
                return

            if args.discover_only:
                log_info(f"Discovery complete. {len(thread_index)} threads saved to {THREAD_INDEX_FILE}")
                return

            # Phase 2: Thread content crawling
            log_info("=== Phase 2: Thread Content Crawling ===")
            crawled_set = set(checkpoint.get("crawled_threads", []))

            # Filter to threads not yet crawled
            pending = [t for t in thread_index if t["thread_id"] not in crawled_set]
            log_info(f"{len(pending)} threads remaining to crawl "
                     f"({len(crawled_set)} already done)")

            if args.max_threads is not None:
                pending = pending[:args.max_threads]
                log_info(f"Limiting to {len(pending)} threads (--max-threads)")

            for i, thread_meta in enumerate(pending, start=1):
                log_info(f"--- Thread {i}/{len(pending)} ---")

                thread_data = crawl_thread(page, thread_meta)
                if thread_data:
                    save_thread(thread_data)
                    crawled_set.add(thread_meta["thread_id"])
                    checkpoint["crawled_threads"] = list(crawled_set)
                    save_checkpoint(checkpoint)
                    log_info(f"  Saved thread {thread_meta['thread_id']}")
                else:
                    log_error(f"Skipping thread {thread_meta['thread_id']} after failures")

                # Delay between threads
                if i < len(pending):
                    time.sleep(REQUEST_DELAY)

            log_info(f"=== Crawl complete: {len(crawled_set)} threads total ===")

        except KeyboardInterrupt:
            log_info("\nInterrupted! Saving checkpoint...")
            save_checkpoint(checkpoint)
            log_info(f"Checkpoint saved. Resume with --resume flag.")
            sys.exit(130)

        except Exception as e:
            log_error(f"Unexpected error: {e}")
            save_checkpoint(checkpoint)
            raise

        finally:
            browser.close()
            log_info("Browser closed.")


if __name__ == "__main__":
    main()
