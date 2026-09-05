import { NextResponse } from "next/server";
import { MODELS, shortName } from "@/lib/models";
import { getDocuments } from "@/lib/documents";
import { loadSections } from "@/lib/sections";

// /llms.txt — site guide for LLM-based agents (https://llmstxt.org).
// Lists what the site contains, how to read pages as JSON/Markdown, and how to search.

const BASE = "https://tsrm.sasquatchvc.com";

export function GET() {
  const lines: string[] = [
    "# TSRM — Toyota Supra Technical Service Repair Manuals",
    "",
    "> Free, searchable Toyota Supra factory service manuals (TSRM), electrical wiring diagrams (EWD) and community-confirmed fixes for the MK2 (A60, 1982–1986), MK3 (A70, 1986.5–1992) and MK4 (A80, 1993–2002). Every manual page is a scanned image with an OCR transcript.",
    "",
    "Not affiliated with Toyota Motor Corporation. Content is scanned factory documentation; verify critical values (torque specs, part numbers) against the page image.",
    "",
    "## How agents should read this site",
    "",
    `- Page (HTML): ${BASE}/{model}/{tsrm|ewd}/{SECTION}/{page} — page scan plus an OCR transcript in a <details> block, BreadcrumbList + TechArticle JSON-LD.`,
    `- Page (JSON): ${BASE}/api/pages/{model}/{tsrm|ewd}/{SECTION}/{page} — title, section, ocr_text, image URL, prev/next links. CORS enabled.`,
    `- Page (Markdown): same URL with ?format=md, or send Accept: text/markdown.`,
    `- Full-text search: ${BASE}/api/search?q={query}&model={mk2|mk3|mk4} — JSON results with section, page, title and matching text.`,
    `- Community fixes search: ${BASE}/api/search/fixes?q={query}&model=mk3 — grouped problems with confirmed fixes and SupraForums thread links.`,
    `- Sitemap: ${BASE}/sitemap.xml (all pages). Robots: ${BASE}/robots.txt (AI crawlers allowed).`,
    "",
    "Model ids: mk2 (A60), mk3 (A70), mk4 (A80). Document ids: tsrm (repair manual), ewd (wiring diagrams). Section codes are upper-case (EM, FI, BR, …); pages are 1-based integers.",
    "",
  ];

  for (const m of MODELS) {
    const docs = getDocuments(m.id);
    const tsrm = loadSections(m.id);
    const ewd = loadSections(`${m.id}-ewd`);
    const pages = (s: { pages: number }[]) => s.reduce((sum, x) => sum + x.pages, 0).toLocaleString();

    lines.push(`## ${shortName(m)} Toyota Supra (${m.generation}) — ${m.year} — ${m.engines}`, "");
    lines.push(`- [${m.name} hub](${BASE}/${m.id}): ${m.summary}`);
    if (tsrm.length) {
      lines.push(`- [Repair Manual](${BASE}/${m.id}/tsrm): ${tsrm.length} sections, ${pages(tsrm)} pages`);
      for (const s of tsrm) lines.push(`  - [${s.name} (${s.code})](${BASE}/${m.id}/tsrm/${s.code}): ${s.pages} pages`);
    }
    if (ewd.length) {
      lines.push(`- [Wiring Diagrams](${BASE}/${m.id}/ewd): ${ewd.length} sections, ${pages(ewd)} pages`);
      for (const s of ewd) lines.push(`  - [${s.name} (${s.code})](${BASE}/${m.id}/ewd/${s.code}): ${s.pages} pages`);
    }
    if (docs.some((d) => d.type === "fixes")) {
      lines.push(`- [Community Fixes](${BASE}/${m.id}/fixes): common problems grouped from confirmed-fix SupraForums threads`);
    }
    lines.push("");
  }

  lines.push(
    "## Optional",
    "",
    `- [Offline downloads](${BASE}/#collections): per-model ZIP archives with every page image and an offline HTML viewer`,
    ""
  );

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
