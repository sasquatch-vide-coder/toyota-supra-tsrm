#!/usr/bin/env bash
# Quick SEO smoke test against a running site (default: production).
# Usage: scripts/seo_check.sh [base_url]
set -u
BASE="${1:-https://tsrm.sasquatchvc.com}"
PROD="https://tsrm.sasquatchvc.com"   # metadataBase — canonical/og URLs always use this host
fail=0

check() { # label, condition-exit-code
  if [ "$2" -eq 0 ]; then echo "  ok   $1"; else echo "  FAIL $1"; fail=1; fi
}

head_tags() { curl -sS "$BASE$1" | grep -o '<head>.*</head>' | sed 's/></>\n</g'; }

echo "== $BASE"

for u in / /mk2 /mk3 /mk4 /mk3/tsrm /mk3/ewd /mk3/fixes /mk3/tsrm/EM /mk3/tsrm/EM/1 /mk3/ewd/INTRO/1 /sitemap.xml /robots.txt /llms.txt; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" "$BASE$u")
  check "$u -> $code" $([ "$code" = "200" ]; echo $?)
done

echo "== hub page /mk3"
H=$(head_tags /mk3)
check "title mentions Toyota Supra"      $(echo "$H" | grep -q '<title>.*Toyota Supra.*</title>'; echo $?)
check "canonical /mk3"                   $(echo "$H" | grep -q 'rel="canonical" href="'"$PROD"'/mk3"'; echo $?)
check "h1 present"                       $(curl -sS "$BASE/mk3" | grep -q '<h1'; echo $?)

echo "== page route /mk3/tsrm/EM/1"
P=$(curl -sS "$BASE/mk3/tsrm/EM/1")
check "h1 present"                       $(echo "$P" | grep -q '<h1'; echo $?)
check "OCR <details> present"            $(echo "$P" | grep -q 'class="ocr-text"'; echo $?)
check "og:image is page scan"            $(echo "$P" | grep -q 'property="og:image" content="'"$PROD"'/images/mk3/EM/EM_001.png"'; echo $?)
check "next/image used (/_next/image)"   $(echo "$P" | grep -q '/_next/image?url=%2Fimages%2Fmk3%2FEM%2FEM_001.png'; echo $?)
check "TechArticle JSON-LD"              $(echo "$P" | grep -q '"@type":"TechArticle"'; echo $?)

echo "== image optimizer"
ct=$(curl -sS -o /dev/null -H 'Accept: image/webp,*/*' -w "%{http_code} %{content_type} %{size_download}" "$BASE/_next/image?url=%2Fimages%2Fmk3%2FEM%2FEM_002.png&w=1280&q=85")
check "optimizer -> $ct"                 $(echo "$ct" | grep -q '^200 image/webp'; echo $?)

echo "== sitemap"
S=$(curl -sS "$BASE/sitemap.xml")
check "no /tsrm/search URLs"             $(! echo "$S" | grep -q '/tsrm/search<'; echo $?)
check "has lastmod"                      $(echo "$S" | grep -q '<lastmod>'; echo $?)
echo "  urls: $(echo "$S" | grep -c '<loc>')"

echo "== AI agent surface"
L=$(curl -sS "$BASE/llms.txt")
check "llms.txt 200 + lists api/pages"   $(echo "$L" | grep -q 'api/pages'; echo $?)
J=$(curl -sS -D - "$BASE/api/pages/mk3/tsrm/EM/1")
check "api/pages JSON has ocr_text"      $(echo "$J" | grep -q '"ocr_text"'; echo $?)
check "api/pages CORS header"            $(echo "$J" | grep -qi '^access-control-allow-origin: \*'; echo $?)
M=$(curl -sS -D - "$BASE/api/pages/mk3/tsrm/EM/1?format=md")
check "api/pages markdown variant"       $(echo "$M" | grep -qi '^content-type: text/markdown'; echo $?)
check "page links JSON alternate"        $(echo "$P" | grep -q 'rel="alternate" type="application/json"'; echo $?)

echo "== robots"
R=$(curl -sS "$BASE/robots.txt")
check "disallows compare"                $(echo "$R" | grep -q 'compare'; echo $?)
check "noindex pages have no canonical"  $(! head_tags /mk3/tsrm/search | grep -q 'rel="canonical"'; echo $?)

[ $fail -eq 0 ] && echo "ALL OK" || { echo "SOME CHECKS FAILED"; exit 1; }
