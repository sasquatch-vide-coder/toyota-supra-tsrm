"""Crawl SupraForums MKIII subforum threads and save as JSON.

Uses curl subprocess for HTTP requests because the site's TLS fingerprinting
blocks Python HTTP libraries (httpx, requests) with 409 responses.
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from bs4 import BeautifulSoup, Tag

FORUM_URL = "https://www.supraforums.com/forums/mkiii-1986-5-1992.13/"
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
FORUM_RAW_DIR = DATA_DIR / "forum" / "raw"
FORUM_INDEX_FILE = DATA_DIR / "forum" / "thread_index.json"
ERRORS_LOG = DATA_DIR / "errors.log"
REQUEST_DELAY = 1.5
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)


def log_error(msg: str) -> None:
    ERRORS_LOG.parent.mkdir(parents=True, exist_ok=True)
    with open(ERRORS_LOG, "a", encoding="utf-8") as f:
        f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} [forum_crawler] {msg}\n")
    print(f"  ERROR: {msg}", file=sys.stderr)


def fetch_url(url: str) -> str | None:
    """Fetch a URL using curl (bypasses TLS fingerprinting that blocks Python libs)."""
    try:
        result = subprocess.run(
            [
                "curl", "-s", "-L",
                "--max-time", "30",
                "-H", f"User-Agent: {USER_AGENT}",
                "-H", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "-H", "Accept-Language: en-US,en;q=0.5",
                url,
            ],
            capture_output=True,
            timeout=45,
        )
        if result.returncode != 0:
            log_error(f"curl failed for {url}: exit code {result.returncode}")
            return None
        body = result.stdout.decode("utf-8", errors="replace")
        if not body.strip():
            log_error(f"curl returned empty body for {url}")
            return None
        return body
    except subprocess.TimeoutExpired:
        log_error(f"curl timed out for {url}")
        return None
    except FileNotFoundError:
        log_error("curl not found. Please install curl.")
        sys.exit(1)


@dataclass
class ThreadMeta:
    thread_id: str
    title: str
    url: str
    author: str = ""
    date_posted: str = ""
    reply_count: int = 0
    view_count: int = 0
    is_sticky: bool = False


@dataclass
class Post:
    author: str
    date: str
    content: str
    post_number: int


@dataclass
class ThreadData:
    meta: ThreadMeta
    posts: list[Post] = field(default_factory=list)
    crawled_at: str = ""


def extract_thread_id(url: str) -> str:
    """Extract thread ID from a XenForo thread URL."""
    # URLs like: /threads/some-title.12345/ or /threads/some-title.12345/page-2
    match = re.search(r'\.(\d+)(?:/|$)', url)
    if match:
        return match.group(1)
    # Fallback: try just the numeric part
    match = re.search(r'/threads/[^/]*?(\d+)', url)
    if match:
        return match.group(1)
    return url.rstrip("/").split(".")[-1]


def parse_count_text(text: str) -> int:
    """Parse count text like '55', '6.4M', '84K' into an integer."""
    text = text.strip().replace(",", "")
    if not text:
        return 0
    try:
        if text.upper().endswith("M"):
            return int(float(text[:-1]) * 1_000_000)
        if text.upper().endswith("K"):
            return int(float(text[:-1]) * 1_000)
        return int(text)
    except ValueError:
        return 0


def parse_thread_listing(html: str) -> list[ThreadMeta]:
    """Parse a forum listing page and extract thread metadata."""
    soup = BeautifulSoup(html, "html.parser")
    threads: list[ThreadMeta] = []

    for item in soup.select("div.structItem--thread"):
        # Title and URL from the main thread title link
        link = item.select_one("a.thread-title--gtm")
        if not link:
            continue

        href = link.get("href", "")
        if isinstance(href, list):
            href = href[0] if href else ""
        title = link.get_text(strip=True)

        if not href or not title:
            continue

        # Build full URL
        if href.startswith("/"):
            url = f"https://www.supraforums.com{href}"
        elif not href.startswith("http"):
            url = f"https://www.supraforums.com/{href}"
        else:
            url = href

        thread_id = extract_thread_id(href)

        # Author
        author = ""
        author_el = item.select_one("a.username")
        if author_el:
            author = author_el.get_text(strip=True)

        # Date - start date from thread creation time
        date_posted = ""
        time_el = item.select_one("time.thread-time--gtm[datetime]")
        if not time_el:
            time_el = item.select_one("time[datetime]")
        if time_el:
            date_posted = time_el.get("datetime", "")
            if isinstance(date_posted, list):
                date_posted = date_posted[0] if date_posted else ""

        # Reply and view counts from dedicated divs
        reply_count = 0
        view_count = 0
        reply_el = item.select_one("div.reply-count")
        if reply_el:
            reply_count = parse_count_text(reply_el.get_text(strip=True))
        view_el = item.select_one("div.view-count")
        if view_el:
            view_count = parse_count_text(view_el.get_text(strip=True))

        # Sticky detection - check for sticky icon
        is_sticky = item.select_one('[title="Sticky"]') is not None

        threads.append(ThreadMeta(
            thread_id=thread_id,
            title=title,
            url=url,
            author=author,
            date_posted=date_posted,
            reply_count=reply_count,
            view_count=view_count,
            is_sticky=is_sticky,
        ))

    return threads


def get_next_page_url(html: str) -> str | None:
    """Extract the next page URL from pagination."""
    soup = BeautifulSoup(html, "html.parser")
    next_link = soup.select_one("a.pageNav-jump--next")
    if next_link:
        href = next_link.get("href", "")
        if isinstance(href, list):
            href = href[0] if href else ""
        if href:
            if href.startswith("/"):
                return f"https://www.supraforums.com{href}"
            if not href.startswith("http"):
                return f"https://www.supraforums.com/{href}"
            return href
    return None


def extract_bbwrapper_text(container: Tag) -> str:
    """Extract text from the first .bbWrapper in a container."""
    body_el = container.select_one(".bbWrapper")
    if not body_el:
        return ""
    # Replace <br> with newlines before getting text
    for br in body_el.find_all("br"):
        br.replace_with("\n")
    return body_el.get_text(separator="\n", strip=False).strip()


def parse_thread_posts(html: str) -> list[Post]:
    """Parse thread page HTML and extract posts.

    Handles the California XenForo theme which uses:
    - .js-originalPostContainer for the OP
    - article[data-author] for reply posts
    """
    soup = BeautifulSoup(html, "html.parser")
    posts: list[Post] = []

    # 1. Extract the OP from the original post container
    op_container = soup.select_one(".js-originalPostContainer")
    if op_container:
        # Author from the name+attributions area
        op_author = ""
        name_el = op_container.select_one(".MessageCard__name-with-attributions")
        if name_el:
            # Get text, strip "Discussion starter" suffix
            op_author = name_el.get_text(strip=True).replace("Discussion starter", "").strip()

        # Date
        op_date = ""
        time_el = op_container.select_one("time[datetime]")
        if time_el:
            op_date = time_el.get("datetime", "")
            if isinstance(op_date, list):
                op_date = op_date[0] if op_date else ""

        # Body
        content = extract_bbwrapper_text(op_container)

        if content:
            posts.append(Post(
                author=op_author,
                date=op_date,
                content=content,
                post_number=1,
            ))

    # 2. Extract reply posts
    for article in soup.select("article[data-author]"):
        author = article.get("data-author", "")
        if isinstance(author, list):
            author = author[0] if author else ""

        # Date
        date = ""
        time_el = article.select_one("time[datetime]")
        if time_el:
            date = time_el.get("datetime", "")
            if isinstance(date, list):
                date = date[0] if date else ""

        # Body
        content = extract_bbwrapper_text(article)

        post_number = len(posts) + 1

        if content:
            posts.append(Post(
                author=author,
                date=date,
                content=content,
                post_number=post_number,
            ))

    return posts


def fetch_thread(meta: ThreadMeta) -> ThreadData | None:
    """Fetch all posts from a thread (handling multi-page threads)."""
    all_posts: list[Post] = []
    url: str | None = meta.url
    page_num = 0

    while url:
        page_num += 1
        html = fetch_url(url)
        if html is None:
            log_error(f"Failed to fetch thread {meta.thread_id} page {page_num}")
            break

        posts = parse_thread_posts(html)
        # Re-number posts with correct offset
        for post in posts:
            post.post_number = len(all_posts) + 1
            all_posts.append(post)

        url = get_next_page_url(html)
        if url:
            time.sleep(REQUEST_DELAY)

    if not all_posts:
        log_error(f"No posts found in thread {meta.thread_id}: {meta.title}")
        return None

    return ThreadData(
        meta=meta,
        posts=all_posts,
        crawled_at=datetime.now(timezone.utc).isoformat(),
    )


def save_thread(thread_data: ThreadData) -> None:
    """Save thread data to JSON file."""
    FORUM_RAW_DIR.mkdir(parents=True, exist_ok=True)
    dest = FORUM_RAW_DIR / f"{thread_data.meta.thread_id}.json"
    data = {
        "meta": asdict(thread_data.meta),
        "posts": [asdict(p) for p in thread_data.posts],
        "crawled_at": thread_data.crawled_at,
    }
    dest.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"  Saved {dest.name} ({len(thread_data.posts)} posts)")


def save_thread_index(all_metas: list[ThreadMeta]) -> None:
    """Save thread index JSON for quick reference."""
    FORUM_INDEX_FILE.parent.mkdir(parents=True, exist_ok=True)
    data = [asdict(m) for m in all_metas]
    FORUM_INDEX_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Saved thread index ({len(all_metas)} threads)")


def crawl_listing(max_pages: int = 3) -> list[ThreadMeta]:
    """Crawl forum listing pages and collect thread metadata."""
    all_threads: list[ThreadMeta] = []
    url: str | None = FORUM_URL

    for page_num in range(1, max_pages + 1):
        if not url:
            break

        print(f"Fetching listing page {page_num}...")
        html = fetch_url(url)
        if html is None:
            log_error(f"Failed to fetch listing page {page_num}")
            break

        # JS fallback detection
        threads = parse_thread_listing(html)
        if page_num == 1 and not threads:
            print(
                "\nWARNING: No threads found on listing page. "
                "The site may require JavaScript rendering (Playwright).\n"
                "Try accessing the URL in a browser to verify.",
                file=sys.stderr,
            )
            return []

        all_threads.extend(threads)
        print(f"  Found {len(threads)} threads on page {page_num}")

        url = get_next_page_url(html)
        if url and page_num < max_pages:
            time.sleep(REQUEST_DELAY)

    return all_threads


def fetch_single_thread(thread_url: str) -> None:
    """Fetch a single thread by URL."""
    thread_id = extract_thread_id(thread_url)
    meta = ThreadMeta(
        thread_id=thread_id,
        title="",
        url=thread_url,
    )

    # Fetch the thread to get the real title
    html = fetch_url(thread_url)
    if html is None:
        log_error(f"Failed to fetch thread URL {thread_url}")
        return

    soup = BeautifulSoup(html, "html.parser")
    title_el = soup.select_one("h1")
    if title_el:
        meta.title = title_el.get_text(strip=True)

    posts = parse_thread_posts(html)
    all_posts = list(posts)

    # Handle multi-page
    next_url = get_next_page_url(html)
    while next_url:
        time.sleep(REQUEST_DELAY)
        page_html = fetch_url(next_url)
        if page_html is None:
            log_error(f"Failed to fetch thread page: {next_url}")
            break
        more_posts = parse_thread_posts(page_html)
        for post in more_posts:
            post.post_number = len(all_posts) + 1
            all_posts.append(post)
        next_url = get_next_page_url(page_html)

    if all_posts:
        thread_data = ThreadData(
            meta=meta,
            posts=all_posts,
            crawled_at=datetime.now(timezone.utc).isoformat(),
        )
        save_thread(thread_data)
    else:
        print(f"No posts found for thread {thread_url}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Crawl SupraForums MKIII subforum threads")
    parser.add_argument("--test", action="store_true", help="Only fetch 3-5 threads for validation")
    parser.add_argument("--max-pages", type=int, default=3, help="Max listing pages to crawl (default: 3)")
    parser.add_argument("--thread", help="Fetch a single thread by URL")
    parser.add_argument("--force", action="store_true", help="Re-download existing threads")
    parser.add_argument("--list-only", action="store_true", help="Only fetch thread listing, don't download content")
    parser.add_argument("--skip-sticky", action="store_true", help="Skip sticky/pinned threads")
    args = parser.parse_args()

    # Single thread mode
    if args.thread:
        print(f"Fetching single thread: {args.thread}")
        fetch_single_thread(args.thread)
        return

    # Crawl listing pages
    max_pages = 1 if args.test else args.max_pages
    all_threads = crawl_listing(max_pages=max_pages)

    if not all_threads:
        print("No threads found. Exiting.")
        return

    # Filter sticky threads if requested
    if args.skip_sticky:
        original = len(all_threads)
        all_threads = [t for t in all_threads if not t.is_sticky]
        print(f"Skipped {original - len(all_threads)} sticky threads")

    # Limit for test mode
    if args.test:
        all_threads = all_threads[:5]
        print(f"Test mode: limited to {len(all_threads)} threads")

    # Save thread index
    save_thread_index(all_threads)

    if args.list_only:
        print(f"\nListing complete. {len(all_threads)} threads indexed.")
        for t in all_threads:
            sticky = " [STICKY]" if t.is_sticky else ""
            print(f"  {t.thread_id}: {t.title}{sticky} ({t.reply_count} replies)")
        return

    # Download thread content
    print(f"\nDownloading {len(all_threads)} threads...")
    for i, meta in enumerate(all_threads, 1):
        dest = FORUM_RAW_DIR / f"{meta.thread_id}.json"

        # Resume support - skip existing
        if dest.exists() and not args.force:
            print(f"  [{i}/{len(all_threads)}] Skipping {meta.thread_id} (already exists)")
            continue

        print(f"  [{i}/{len(all_threads)}] Fetching: {meta.title}")
        thread_data = fetch_thread(meta)
        if thread_data:
            save_thread(thread_data)
        time.sleep(REQUEST_DELAY)

    print(f"\nDone! Downloaded threads to {FORUM_RAW_DIR}")


if __name__ == "__main__":
    main()
