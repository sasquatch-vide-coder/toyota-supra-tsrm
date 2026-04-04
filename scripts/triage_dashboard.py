"""Simple web dashboard to monitor forum triage progress."""

import json
import os
import threading
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "data" / "forum"
RAW_DIR = ROOT / "raw"
TRIAGED_DIR = ROOT / "triaged"

# Cached stats updated by background thread
_stats = {
    "raw": 0, "triaged": 0, "remaining": 0, "fixes": 0,
    "rate": 0.0, "eta_min": None, "pct": 0.0, "recent_fixes": [],
}
_stats_lock = threading.Lock()
_history: list[tuple[float, int]] = []


def count_json_files(directory: Path) -> int:
    """Fast file count using os.scandir instead of glob."""
    count = 0
    try:
        with os.scandir(directory) as entries:
            for e in entries:
                if e.name.endswith(".json") and e.is_file():
                    count += 1
    except OSError:
        pass
    return count


def scan_fixes(directory: Path) -> tuple[int, list[dict]]:
    """Scan triaged dir for fixes. Returns (count, recent_list)."""
    fixes = 0
    fix_list = []
    try:
        with os.scandir(directory) as entries:
            for e in entries:
                if not e.name.endswith(".json") or not e.is_file():
                    continue
                try:
                    data = json.loads(Path(e.path).read_text(encoding="utf-8"))
                    if data.get("has_fix") and data.get("confidence", 0) >= 0.7:
                        fixes += 1
                        fix_list.append({
                            "thread_id": data.get("thread_id", e.name[:-5]),
                            "confidence": data.get("confidence", 0),
                            "reason": data.get("reason", ""),
                            "model": data.get("model", "unknown"),
                        })
                except (json.JSONDecodeError, OSError):
                    pass
    except OSError:
        pass
    fix_list.sort(key=lambda x: x["confidence"], reverse=True)
    return fixes, fix_list[:20]


def update_stats():
    """Background thread that refreshes stats every 15 seconds."""
    global _stats, _history
    while True:
        try:
            raw_count = count_json_files(RAW_DIR)
            triaged_count = count_json_files(TRIAGED_DIR)
            remaining = raw_count - triaged_count

            now = time.time()
            _history.append((now, triaged_count))
            cutoff = now - 300
            while _history and _history[0][0] < cutoff:
                _history.pop(0)

            rate = 0.0
            eta_min = None
            if len(_history) >= 2:
                dt = _history[-1][0] - _history[0][0]
                dn = _history[-1][1] - _history[0][1]
                if dt > 0 and dn > 0:
                    rate = dn / (dt / 60)
                    eta_min = remaining / rate if rate > 0 else None

            fixes, fix_list = scan_fixes(TRIAGED_DIR)

            with _stats_lock:
                _stats = {
                    "raw": raw_count,
                    "triaged": triaged_count,
                    "remaining": remaining,
                    "fixes": fixes,
                    "rate": round(rate, 1),
                    "eta_min": round(eta_min, 0) if eta_min else None,
                    "pct": round(triaged_count / raw_count * 100, 1) if raw_count else 0,
                    "recent_fixes": fix_list,
                }
        except Exception as exc:
            print(f"Stats update error: {exc}")

        time.sleep(15)


HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Triage Dashboard</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0a0a0a; color: #e0e0e0; font-family: 'Segoe UI', system-ui, sans-serif; padding: 2rem; }
  h1 { font-size: 1.5rem; color: #ff4444; margin-bottom: 1.5rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
  .card { background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 1.2rem; }
  .card .label { font-size: 0.75rem; text-transform: uppercase; color: #888; letter-spacing: 0.05em; }
  .card .value { font-size: 2rem; font-weight: 700; margin-top: 0.3rem; }
  .card .value.fix { color: #4caf50; }
  .card .value.rate { color: #2196f3; }
  .card .value.eta { color: #ff9800; }
  .progress-wrap { background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 1.2rem; margin-bottom: 2rem; }
  .progress-bar { background: #222; border-radius: 4px; height: 28px; overflow: hidden; position: relative; }
  .progress-fill { background: linear-gradient(90deg, #ff4444, #ff6644); height: 100%; transition: width 1s ease; }
  .progress-text { position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.85rem; }
  h2 { font-size: 1.1rem; color: #ccc; margin-bottom: 0.8rem; }
  .fix-table { width: 100%; border-collapse: collapse; }
  .fix-table th { text-align: left; font-size: 0.75rem; text-transform: uppercase; color: #888; padding: 0.5rem; border-bottom: 1px solid #333; }
  .fix-table td { padding: 0.5rem; border-bottom: 1px solid #1a1a1a; font-size: 0.85rem; }
  .fix-table tr:hover { background: #1a1a1a; }
  .conf { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 0.8rem; }
  .conf-high { background: #1b3a1b; color: #4caf50; }
  .conf-med { background: #3a3a1b; color: #ff9800; }
  .model-tag { font-size: 0.7rem; padding: 2px 6px; border-radius: 3px; background: #222; color: #888; }
  .updated { font-size: 0.75rem; color: #555; margin-top: 1rem; }
</style>
</head>
<body>
<h1>Forum Triage Dashboard</h1>
<div class="grid">
  <div class="card"><div class="label">Total Threads</div><div class="value" id="raw">-</div></div>
  <div class="card"><div class="label">Triaged</div><div class="value" id="triaged">-</div></div>
  <div class="card"><div class="label">Remaining</div><div class="value" id="remaining">-</div></div>
  <div class="card"><div class="label">Fixes Found</div><div class="value fix" id="fixes">-</div></div>
  <div class="card"><div class="label">Rate (threads/min)</div><div class="value rate" id="rate">-</div></div>
  <div class="card"><div class="label">ETA</div><div class="value eta" id="eta">-</div></div>
</div>
<div class="progress-wrap">
  <div class="progress-bar">
    <div class="progress-fill" id="fill" style="width:0%"></div>
    <div class="progress-text" id="pct">0%</div>
  </div>
</div>
<h2>Recent Fixes</h2>
<table class="fix-table">
  <thead><tr><th>Thread</th><th>Confidence</th><th>Model</th><th>Reason</th></tr></thead>
  <tbody id="fixes-body"></tbody>
</table>
<div class="updated" id="updated"></div>
<script>
async function refresh() {
  try {
    const r = await fetch('/api/stats');
    const d = await r.json();
    document.getElementById('raw').textContent = d.raw.toLocaleString();
    document.getElementById('triaged').textContent = d.triaged.toLocaleString();
    document.getElementById('remaining').textContent = d.remaining.toLocaleString();
    document.getElementById('fixes').textContent = d.fixes.toLocaleString();
    document.getElementById('rate').textContent = d.rate || '-';
    const eta = d.eta_min;
    if (eta) {
      const h = Math.floor(eta / 60);
      const m = Math.round(eta % 60);
      document.getElementById('eta').textContent = h > 0 ? h + 'h ' + m + 'm' : m + 'm';
    } else {
      document.getElementById('eta').textContent = '-';
    }
    document.getElementById('fill').style.width = d.pct + '%';
    document.getElementById('pct').textContent = d.pct + '%';
    const tbody = document.getElementById('fixes-body');
    tbody.innerHTML = '';
    for (const f of d.recent_fixes) {
      const confClass = f.confidence >= 0.85 ? 'conf-high' : 'conf-med';
      tbody.innerHTML += '<tr><td>' + f.thread_id + '</td><td><span class="conf ' + confClass + '">' + f.confidence.toFixed(2) + '</span></td><td><span class="model-tag">' + f.model + '</span></td><td>' + f.reason.substring(0, 120) + '</td></tr>';
    }
    document.getElementById('updated').textContent = 'Updated: ' + new Date().toLocaleTimeString();
  } catch(e) {}
}
refresh();
setInterval(refresh, 10000);
</script>
</body>
</html>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/api/stats":
            with _stats_lock:
                data = json.dumps(_stats)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(data.encode())
        else:
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(HTML.encode())

    def log_message(self, format, *args):
        pass


def main():
    port = 8099
    # Start background stats updater
    t = threading.Thread(target=update_stats, daemon=True)
    t.start()
    server = HTTPServer(("127.0.0.1", port), Handler)
    print(f"Dashboard running at http://localhost:{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
