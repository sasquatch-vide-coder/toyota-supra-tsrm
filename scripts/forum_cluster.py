"""Group confirmed forum fixes into distinct issues via local embeddings.

Output is purely a grouping: each issue cluster lists the source threads (links)
where that issue was confirmed fixed. No authored repair content.

Everything runs locally (Ollama embeddings + scipy clustering) -- zero API tokens.

Subcommands:
  build    Materialize confirmed fixes (triaged + raw join) -> confirmed_fixes.json
  embed    Embed each fix's text with a local embedding model -> embeddings.npy
  cluster  Agglomerative-cluster embeddings at a distance threshold -> groups
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

import numpy as np

ROOT_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DEFAULT_SUPRA = "mk3"
MIN_CONFIDENCE = 0.85

OLLAMA_URL = "http://localhost:11434"
EMBED_MODEL = "nomic-embed-text"

# Heuristic keyword -> system map. Used ONLY to organize/slice output, not to
# decide grouping (that's the embeddings). First match wins, order matters.
SYSTEM_KEYWORDS: list[tuple[str, list[str]]] = [
    ("cooling", ["overheat", "coolant", "radiator", "thermostat", "water pump",
                 "cooling fan", "temp gauge", "temperature gauge", "head gasket",
                 "antifreeze", "fan clutch", "heater core"]),
    ("fuel", ["fuel pump", "injector", "fuel filter", "afm", "air flow meter",
              "fuel pressure", "afpr", "fuel rail", "gas tank", "fuel leak"]),
    ("turbo", ["turbo", "boost", "wastegate", "bov", "blow off", "ct26",
               "intercooler", "boost leak", "boost cut"]),
    ("electrical", ["wiring", "wire", "fuse", "relay", "ecu", "alternator",
                    "battery", "ground", "headlight", "gauge", "fuel pump relay",
                    "ignition switch", "no power", "dead", "short circuit",
                    "igniter", "coil", "spark", "distributor", "tps", "sensor"]),
    ("transmission", ["transmission", "clutch", "gearbox", "shift", "syncro",
                      "synchro", "r154", "w58", "gear grind", "differential",
                      "diff", "axle", "driveshaft", "auto trans", "torque converter"]),
    ("brakes", ["brake", "rotor", "caliper", "abs", "master cylinder", "pads",
                "brake fluid"]),
    ("suspension", ["suspension", "strut", "shock", "tems", "spring", "bushing",
                    "control arm", "ball joint", "alignment", "steering",
                    "power steering", "tie rod", "wheel bearing"]),
    ("exhaust", ["exhaust", "muffler", "catalytic", "downpipe", "header",
                 "manifold leak", "o2 sensor"]),
    ("engine", ["idle", "stall", "misfire", "knock", "rough", "rod knock",
                "timing belt", "oil leak", "valve", "rebuild", "compression",
                "vacuum leak", "hesitat", "surge", "won't start", "wont start",
                "no start", "cranks", "smoke", "blow by", "oil pressure",
                "7mgte", "7mge", "1jz", "2jz", "bhg"]),
]


def get_dirs(supra: str) -> tuple[Path, Path, Path]:
    base = ROOT_DATA_DIR / "forum" / supra
    return base / "raw", base / "triaged", base


def guess_system(title: str, reason: str) -> str:
    text = f"{title} {reason}".lower()
    for system, keywords in SYSTEM_KEYWORDS:
        for kw in keywords:
            if kw in text:
                return system
    return "other"


# ---------------------------------------------------------------------------
# build
# ---------------------------------------------------------------------------

def cmd_build(args: argparse.Namespace) -> None:
    raw_dir, triaged_dir, base = get_dirs(args.supra)
    out_path = base / "confirmed_fixes.json"

    fixes = []
    skipped_no_raw = 0
    n_triaged = 0
    for tp in sorted(triaged_dir.glob("*.json")):
        n_triaged += 1
        try:
            t = json.loads(tp.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        if not (t.get("has_fix") and t.get("confidence", 0) >= args.min_conf):
            continue
        rp = raw_dir / tp.name
        if not rp.exists():
            skipped_no_raw += 1
            continue
        try:
            r = json.loads(rp.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        title = r.get("title", "") or ""
        reason = t.get("reason", "") or ""
        posts = r.get("posts", [])
        first_post = (posts[0].get("content", "") if posts else "") or ""
        # Truncate first post; the problem is stated up front, and nomic has a
        # limited context window.
        first_post = " ".join(first_post.split())[:1200]
        fixes.append({
            "thread_id": t.get("thread_id", tp.stem),
            "title": title,
            "url": r.get("url", ""),
            "reason": reason,
            "first_post": first_post,
            "confidence": t.get("confidence", 0),
            "post_count": len(posts),
            "triage_model": t.get("model", ""),
            "system": guess_system(title, reason),
        })

    fixes.sort(key=lambda f: f["thread_id"])
    out_path.write_text(json.dumps(fixes, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"Scanned {n_triaged} triaged files")
    print(f"Confirmed fixes (has_fix & conf>={args.min_conf}): {len(fixes)}")
    if skipped_no_raw:
        print(f"  (skipped {skipped_no_raw} with no matching raw thread)")
    print(f"Wrote -> {out_path}")

    # System distribution
    from collections import Counter
    dist = Counter(f["system"] for f in fixes)
    print("\nSystem distribution (heuristic, for slicing/organization only):")
    for sysname, c in dist.most_common():
        print(f"  {c:>5}  {sysname}")


# ---------------------------------------------------------------------------
# label  (local LLM distills each thread to a canonical issue phrase)
# ---------------------------------------------------------------------------

LABEL_PROMPT = """You are categorizing a Toyota Supra MKIII forum thread that contains a confirmed repair fix.

Given the thread title and first post, output the SPECIFIC underlying problem as a short canonical phrase, plus the vehicle system.

Rules:
- "issue": 3 to 8 words naming the CONCRETE problem (symptom, plus cause/location if clear). Phrase it CONSISTENTLY so two threads about the same problem get nearly identical text. Strip emotion, usernames, slang, year/model chatter.
  Good examples: "overheating at idle in traffic", "blown head gasket coolant in oil", "coolant leak from heater hose", "temperature gauge reads erratically", "radiator fan clutch failed", "no start after head gasket job", "rough idle when cold".
- "system": exactly one of: engine, electrical, cooling, fuel, turbo, transmission, brakes, suspension, exhaust, body, other.

Respond with ONLY valid JSON: {"issue": "...", "system": "..."}"""


def call_ollama_chat(prompt: str, model: str, timeout: int = 180,
                     num_ctx: int = 2048) -> str | None:
    # num_ctx kept small: our prompts are ~700 tokens, and the model's default
    # 131072 context reserves huge KV cache (slow + VRAM-hungry). Shrinking it
    # massively speeds up throughput and frees VRAM for parallelism.
    payload = json.dumps({
        "model": model,
        "messages": [
            {"role": "system", "content": "You output only valid JSON. No markdown, no code fences, no explanation."},
            {"role": "user", "content": prompt},
        ],
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.0, "num_ctx": num_ctx},
    }).encode()
    req = urllib.request.Request(
        f"{OLLAMA_URL}/api/chat", data=payload,
        headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode())
        return data.get("message", {}).get("content", "")
    except Exception as e:
        print(f"  ollama chat error: {e}", file=sys.stderr)
        return None


def parse_label(text: str) -> dict | None:
    if not text:
        return None
    s = text.strip()
    start = s.find("{")
    if start == -1:
        return None
    try:
        obj, _ = json.JSONDecoder().raw_decode(s[start:])
    except json.JSONDecodeError:
        return None
    if not isinstance(obj, dict) or "issue" not in obj:
        return None
    return obj


def cmd_label(args: argparse.Namespace) -> None:
    _, _, base = get_dirs(args.supra)
    fixes = json.loads((base / "confirmed_fixes.json").read_text(encoding="utf-8"))
    if args.system:
        fixes = [f for f in fixes if f["system"] == args.system]
    if args.max:
        fixes = fixes[: args.max]

    labels_path = base / (f"labels_{args.tag}.json" if args.tag else "labels.json")
    labels: dict[str, dict] = {}
    if labels_path.exists() and not args.force:
        labels = json.loads(labels_path.read_text(encoding="utf-8"))

    todo = [f for f in fixes if f["thread_id"] not in labels]
    print(f"Labeling {len(todo)} fixes (of {len(fixes)}) with {args.model} "
          f"({args.workers} workers); {len(labels)} already done")

    import threading
    lock = threading.Lock()
    t0 = time.time()
    state = {"done": 0}

    def label_one(f: dict) -> tuple[str, dict]:
        prompt = (f"{LABEL_PROMPT}\n\n---\nThread title: {f['title']}\n"
                  f"First post: {f.get('first_post','')}")
        obj = None
        for _ in range(2):  # one retry on parse/transport failure
            resp = call_ollama_chat(prompt, args.model, num_ctx=args.num_ctx)
            obj = parse_label(resp)
            if obj is not None:
                break
        if obj is None:
            return f["thread_id"], {"issue": f["title"], "system": f["system"], "_failed": True}
        return f["thread_id"], {
            "issue": str(obj.get("issue", f["title"]))[:120],
            "system": str(obj.get("system", f["system"])).lower().strip(),
        }

    def record(tid: str, lab: dict) -> None:
        with lock:
            labels[tid] = lab
            state["done"] += 1
            done = state["done"]
            if done % 25 == 0 or done == len(todo):
                labels_path.write_text(json.dumps(labels, ensure_ascii=False, indent=1), encoding="utf-8")
                rate = done / (time.time() - t0)
                eta = (len(todo) - done) / rate if rate else 0
                print(f"  {done}/{len(todo)}  ({rate:.2f}/s, ETA {eta/60:.1f} min)", flush=True)

    if args.workers > 1:
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=args.workers) as ex:
            for tid, lab in ex.map(label_one, todo):
                record(tid, lab)
    else:
        for f in todo:
            tid, lab = label_one(f)
            record(tid, lab)

    labels_path.write_text(json.dumps(labels, ensure_ascii=False, indent=1), encoding="utf-8")
    n_failed = sum(1 for v in labels.values() if v.get("_failed"))
    print(f"Done. Wrote {len(labels)} labels -> {labels_path} ({n_failed} fell back to title)")


# ---------------------------------------------------------------------------
# embed
# ---------------------------------------------------------------------------

def embed_texts(texts: list[str], model: str, batch_size: int = 64,
                prefix: str = "") -> np.ndarray:
    """Embed texts via Ollama /api/embed (batched). Returns L2-normalized array.

    `prefix` is prepended to each text (nomic-embed-text expects a task prefix
    like "clustering: " or "search_document: ").
    """
    vecs: list[list[float]] = []
    n = len(texts)
    if prefix:
        texts = [prefix + t for t in texts]
    for i in range(0, n, batch_size):
        batch = texts[i:i + batch_size]
        payload = json.dumps({"model": model, "input": batch}).encode()
        req = urllib.request.Request(
            f"{OLLAMA_URL}/api/embed",
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req, timeout=300) as resp:
                    data = json.loads(resp.read().decode())
                emb = data.get("embeddings")
                if not emb or len(emb) != len(batch):
                    raise ValueError(f"expected {len(batch)} embeddings, got {len(emb) if emb else 0}")
                vecs.extend(emb)
                break
            except Exception as e:
                if attempt == 3:
                    print(f"  ERROR embedding batch {i}-{i+len(batch)}: {e}", file=sys.stderr)
                    raise
                time.sleep(2 * (attempt + 1))
        print(f"  embedded {min(i + batch_size, n)}/{n}", end="\r", flush=True)
    print()
    arr = np.asarray(vecs, dtype=np.float32)
    # L2 normalize so dot product == cosine similarity
    norms = np.linalg.norm(arr, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return arr / norms


def fix_text(fix: dict, field: str = "both") -> str:
    """The text we embed for similarity.

    The triage `reason` is the highest-signal field (it states the actual
    problem + fix); titles are often vague/emotional ("Noooooo!!!") and pull
    unrelated threads together, so `reason` is the default.
    """
    title = fix.get("title", "")
    reason = fix.get("reason", "")
    first_post = fix.get("first_post", "")
    if field == "title":
        return title.strip()
    if field == "reason":
        return reason.strip() or title.strip()
    if field == "problem":
        # Title + the OP's actual problem statement (highest issue signal).
        return f"{title}. {first_post}".strip() or reason.strip()
    return f"{title}. {reason}".strip()


def cmd_embed(args: argparse.Namespace) -> None:
    _, _, base = get_dirs(args.supra)
    fixes = json.loads((base / "confirmed_fixes.json").read_text(encoding="utf-8"))
    if args.system:
        fixes = [f for f in fixes if f["system"] == args.system]
    if args.max:
        fixes = fixes[: args.max]

    if args.field == "label":
        lt = base / (f"labels_{args.labels_tag}.json" if args.labels_tag else "labels.json")
        labels = json.loads(lt.read_text(encoding="utf-8"))
        # keep only fixes we have a label for, in stable order
        fixes = [f for f in fixes if f["thread_id"] in labels]
        texts = [labels[f["thread_id"]].get("issue", f["title"]) for f in fixes]
    else:
        texts = [fix_text(f, args.field) for f in fixes]
    print(f"Embedding {len(texts)} fixes with {args.model} "
          f"(field={args.field}, prefix={args.prefix!r})...")
    t0 = time.time()
    arr = embed_texts(texts, args.model, batch_size=args.batch_size, prefix=args.prefix)
    print(f"  done in {time.time() - t0:.1f}s, shape={arr.shape}")

    suffix = f"_{args.tag}" if args.tag else (f"_{args.system}" if args.system else "")
    np.save(base / f"embeddings{suffix}.npy", arr)
    (base / f"embed_ids{suffix}.json").write_text(
        json.dumps([f["thread_id"] for f in fixes]), encoding="utf-8")
    print(f"Wrote -> embeddings{suffix}.npy + embed_ids{suffix}.json")


# ---------------------------------------------------------------------------
# cluster
# ---------------------------------------------------------------------------

def cmd_cluster(args: argparse.Namespace) -> None:
    from scipy.cluster.hierarchy import linkage, fcluster
    from scipy.spatial.distance import pdist

    _, _, base = get_dirs(args.supra)
    suffix = f"_{args.tag}" if args.tag else (f"_{args.system}" if args.system else "")
    arr = np.load(base / f"embeddings{suffix}.npy")
    ids = json.loads((base / f"embed_ids{suffix}.json").read_text(encoding="utf-8"))
    fixes_all = json.loads((base / "confirmed_fixes.json").read_text(encoding="utf-8"))
    by_id = {f["thread_id"]: f for f in fixes_all}

    # Optional LLM issue-labels: used to name each group and assign its system
    # (majority vote), which is more reliable than the keyword heuristic.
    label_map: dict[str, dict] = {}
    if args.labels_tag is not None:
        lt = base / (f"labels_{args.labels_tag}.json" if args.labels_tag else "labels.json")
        if lt.exists():
            label_map = json.loads(lt.read_text(encoding="utf-8"))

    from collections import Counter

    def group_name_system(members: list[str]) -> tuple[str, str]:
        if label_map:
            issues = [label_map[t]["issue"] for t in members if t in label_map]
            systems = [label_map[t].get("system", "other") for t in members if t in label_map]
            name = Counter(issues).most_common(1)[0][0] if issues else by_id[members[0]]["title"]
            system = Counter(systems).most_common(1)[0][0] if systems else "other"
            return name, system
        rep = max(members, key=lambda t: (by_id[t]["confidence"], by_id[t]["post_count"]))
        return by_id[rep]["title"], by_id[rep]["system"]

    print(f"Clustering {len(ids)} fixes (cosine, {args.linkage} linkage)...")
    if args.linkage == "ward":
        # Ward needs Euclidean; on L2-normalized vectors euclidean^2 = 2(1-cos),
        # so this is a valid monotone transform of cosine distance.
        Z = linkage(arr.astype(np.float64), method="ward", metric="euclidean")
    else:
        dists = pdist(arr.astype(np.float64), metric="cosine")
        Z = linkage(dists, method=args.linkage)

    for thr in args.thresholds:
        labels = fcluster(Z, t=thr, criterion="distance")
        n_clusters = len(set(labels))
        sizes = np.bincount(labels)
        sizes = sizes[sizes > 0]
        singletons = int((sizes == 1).sum())
        print(f"\n  threshold={thr:.2f} -> {n_clusters} groups "
              f"({singletons} singletons, largest={sizes.max()}, "
              f"median size={int(np.median(sizes))})")

    # Use the last threshold (or --pick) for detailed output
    thr = args.pick if args.pick else args.thresholds[-1]
    labels = fcluster(Z, t=thr, criterion="distance")
    groups: dict[int, list[str]] = {}
    for tid, lab in zip(ids, labels):
        groups.setdefault(int(lab), []).append(tid)

    ordered = sorted(groups.values(), key=len, reverse=True)
    print(f"\n=== Sample groups at threshold={thr:.2f} "
          f"({len(ordered)} groups, showing multi-thread ones) ===")
    shown = 0
    for members in ordered:
        if len(members) < 2:
            continue
        if shown >= args.show:
            break
        shown += 1
        name, system = group_name_system(members)
        print(f"\n  [{system}] ({len(members)} threads) ISSUE: {name}")
        for t in members[:8]:
            f = by_id[t]
            lbl = f"  ::{label_map[t]['issue']}" if t in label_map else ""
            print(f"      - {f['title']}{lbl}  ({f['url']})")
        if len(members) > 8:
            print(f"      ... +{len(members) - 8} more")

    if args.write:
        out = []
        for members in ordered:
            members_sorted = sorted(
                members, key=lambda t: (by_id[t]["confidence"], by_id[t]["post_count"]),
                reverse=True)
            name, system = group_name_system(members)
            out.append({
                "issue": name,
                "system": system,
                "thread_count": len(members),
                "threads": [
                    {"thread_id": t, "title": by_id[t]["title"], "url": by_id[t]["url"],
                     "issue_label": label_map.get(t, {}).get("issue", ""),
                     "confidence": by_id[t]["confidence"], "post_count": by_id[t]["post_count"]}
                    for t in members_sorted
                ],
            })
        # sort master list by system then by size (biggest issues first)
        out.sort(key=lambda g: (g["system"], -g["thread_count"]))
        out_path = base / f"issue_groups{suffix}.json"
        out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"\nWrote {len(out)} groups -> {out_path}")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--supra", default=DEFAULT_SUPRA)
    sub = p.add_subparsers(dest="cmd", required=True)

    b = sub.add_parser("build", help="Materialize confirmed fixes")
    b.add_argument("--min-conf", type=float, default=MIN_CONFIDENCE)
    b.set_defaults(func=cmd_build)

    e = sub.add_parser("embed", help="Embed fixes locally")
    e.add_argument("--model", default=EMBED_MODEL)
    e.add_argument("--system", default=None, help="Only embed this heuristic system slice")
    e.add_argument("--max", type=int, default=None)
    e.add_argument("--batch-size", type=int, default=64)
    e.add_argument("--prefix", default="clustering: ",
                   help="Task prefix prepended to each text (nomic expects one)")
    e.add_argument("--field", default="both",
                   choices=["title", "reason", "both", "problem", "label"],
                   help="Which text to embed ('problem' = title + OP first post; "
                        "'label' = LLM canonical issue phrase)")
    e.add_argument("--labels-tag", default=None, help="Labels file tag (for field=label)")
    e.add_argument("--tag", default=None, help="Output filename tag (for experiments)")
    e.set_defaults(func=cmd_embed)

    lb = sub.add_parser("label", help="Distill each fix to a canonical issue phrase (local LLM)")
    lb.add_argument("--model", default="gemma4:12b")
    lb.add_argument("--system", default=None)
    lb.add_argument("--max", type=int, default=None)
    lb.add_argument("--tag", default=None, help="Labels filename tag")
    lb.add_argument("--workers", type=int, default=1, help="Parallel requests to Ollama")
    lb.add_argument("--num-ctx", type=int, default=2048, help="Ollama context window")
    lb.add_argument("--force", action="store_true", help="Re-label all (ignore existing)")
    lb.set_defaults(func=cmd_label)

    c = sub.add_parser("cluster", help="Cluster embeddings")
    c.add_argument("--system", default=None)
    c.add_argument("--tag", default=None, help="Embedding filename tag to load")
    c.add_argument("--labels-tag", default=None,
                   help="Load LLM labels (this tag) to name groups + assign system")
    c.add_argument("--linkage", default="average",
                   choices=["average", "complete", "ward", "single"])
    c.add_argument("--thresholds", type=float, nargs="+",
                   default=[0.10, 0.15, 0.20, 0.25, 0.30])
    c.add_argument("--pick", type=float, default=None, help="Threshold for detailed output/write")
    c.add_argument("--show", type=int, default=15, help="How many sample groups to print")
    c.add_argument("--write", action="store_true", help="Write issue_groups.json")
    c.set_defaults(func=cmd_cluster)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
