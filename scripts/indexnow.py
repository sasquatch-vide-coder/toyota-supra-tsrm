#!/usr/bin/env python3
"""Submit the live sitemap's URLs to IndexNow (Bing, Yandex, Seznam, Naver, DuckDuckGo via Bing).

Run after each production deploy that changes content or metadata:
    python scripts/indexnow.py            # submit every sitemap URL
    python scripts/indexnow.py --dry-run  # just count/print

The key lives in website/public/<key>.txt (served at https://tsrm.sasquatchvc.com/<key>.txt);
this script discovers it from that file so the two can never drift apart.
"""
import glob
import json
import os
import re
import sys
import urllib.request

HOST = "tsrm.sasquatchvc.com"
BASE = f"https://{HOST}"
BATCH = 10_000  # IndexNow max per request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
key_files = [f for f in glob.glob(os.path.join(ROOT, "website", "public", "*.txt"))
             if re.fullmatch(r"[0-9a-f]{32}", os.path.basename(f)[:-4] or "")]
if len(key_files) != 1:
    sys.exit(f"expected exactly one 32-hex key file in website/public, found {len(key_files)}")
KEY = os.path.basename(key_files[0])[:-4]

sitemap = urllib.request.urlopen(f"{BASE}/sitemap.xml", timeout=60).read().decode()
urls = re.findall(r"<loc>([^<]+)</loc>", sitemap)
print(f"{len(urls)} URLs in sitemap; key {KEY[:6]}… at {BASE}/{KEY}.txt")

if "--dry-run" in sys.argv:
    print("\n".join(urls[:5]), "...")
    sys.exit(0)

for i in range(0, len(urls), BATCH):
    body = json.dumps({"host": HOST, "key": KEY, "keyLocation": f"{BASE}/{KEY}.txt", "urlList": urls[i:i + BATCH]}).encode()
    req = urllib.request.Request("https://api.indexnow.org/IndexNow", data=body,
                                 headers={"Content-Type": "application/json; charset=utf-8"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            print(f"batch {i // BATCH + 1}: HTTP {r.status} (200/202 = accepted)")
    except urllib.error.HTTPError as e:
        print(f"batch {i // BATCH + 1}: HTTP {e.code} {e.read().decode()[:200]}")
        sys.exit(1)
