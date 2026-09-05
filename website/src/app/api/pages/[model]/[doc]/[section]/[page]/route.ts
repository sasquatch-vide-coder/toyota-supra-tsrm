import { NextRequest, NextResponse } from "next/server";
import { getModel, shortName } from "@/lib/models";
import { loadSections } from "@/lib/sections";
import { loadPage } from "@/lib/pages";
import { titleCase } from "@/lib/seo";

// Machine-readable page content for AI agents and scripts.
//   GET /api/pages/{mk2|mk3|mk4}/{tsrm|ewd}/{SECTION}/{page}            -> JSON
//   GET /api/pages/{...}?format=md   (or Accept: text/markdown)          -> Markdown
// Discoverable via /llms.txt and <link rel="alternate" type="application/json"> on each page.

const BASE = "https://tsrm.sasquatchvc.com";
const DOC_LABEL: Record<string, string> = { tsrm: "Repair Manual", ewd: "Electrical Wiring Diagram" };

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Accept, Content-Type",
};

function json(body: unknown, status = 200, cache = "public, s-maxage=86400, stale-while-revalidate=604800") {
  return NextResponse.json(body, { status, headers: { ...CORS_HEADERS, "Cache-Control": cache } });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ model: string; doc: string; section: string; page: string }> }
) {
  const { model, doc, section, page } = await params;
  const modelDef = getModel(model);
  const docLabel = DOC_LABEL[doc];
  const pageNum = parseInt(page, 10);
  if (!modelDef || !docLabel || !Number.isFinite(pageNum)) {
    return json({ error: "Not found" }, 404, "public, max-age=300");
  }

  const contentDir = doc === "ewd" ? `${model}-ewd` : model;
  const sections = loadSections(contentDir);
  const sectionInfo = sections.find((s) => s.code === section);
  const data = sectionInfo ? loadPage(contentDir, section, pageNum) : null;
  if (!sectionInfo || !data) {
    return json({ error: "Not found" }, 404, "public, max-age=300");
  }

  const index = sectionInfo.page_index || [];
  const idx = index.findIndex((p) => p.page === pageNum);
  const prev = idx > 0 ? index[idx - 1].page : null;
  const next = idx >= 0 && idx < index.length - 1 ? index[idx + 1].page : null;
  const pageUrl = (p: number) => `${BASE}/${model}/${doc}/${section}/${p}`;
  const apiUrl = (p: number) => `${BASE}/api/pages/${model}/${doc}/${section}/${p}`;
  const image = `${BASE}/images/${contentDir}/${section}/${section}_${String(pageNum).padStart(3, "0")}.png`;
  const title = titleCase(data.title) || sectionInfo.name;

  const body = {
    model,
    model_name: modelDef.name,
    vehicle: `Toyota Supra ${modelDef.generation} (${modelDef.year}, ${modelDef.engines})`,
    document: docLabel,
    section,
    section_name: sectionInfo.name,
    page: pageNum,
    pages_in_section: sectionInfo.pages,
    title,
    section_header: titleCase(data.section_header),
    ocr_text: data.ocr_text ?? "",
    image,
    url: pageUrl(pageNum),
    prev: prev !== null ? { page: prev, url: pageUrl(prev), api: apiUrl(prev) } : null,
    next: next !== null ? { page: next, url: pageUrl(next), api: apiUrl(next) } : null,
    section_url: `${BASE}/${model}/${doc}/${section}`,
    section_api_pages: index.map((p) => apiUrl(p.page)),
    note: "OCR transcript of a scanned Toyota factory manual page; verify critical values (torque specs, part numbers) against the image.",
  };

  const wantsMarkdown =
    request.nextUrl.searchParams.get("format") === "md" ||
    (request.headers.get("accept") ?? "").includes("text/markdown");

  if (!wantsMarkdown) return json(body);

  const md = [
    `# ${title}`,
    "",
    `**${shortName(modelDef)} Toyota Supra (${modelDef.generation}) — ${docLabel} — ${sectionInfo.name} (${section}), page ${pageNum} of ${sectionInfo.pages}**`,
    "",
    `- Page: ${body.url}`,
    `- Image: ${image}`,
    `- Section: ${body.section_url}`,
    prev !== null ? `- Previous page: ${pageUrl(prev)}` : null,
    next !== null ? `- Next page: ${pageUrl(next)}` : null,
    "",
    "---",
    "",
    body.ocr_text || "_No OCR text for this page._",
    "",
    "---",
    `_${body.note}_`,
    "",
  ]
    .filter((line) => line !== null)
    .join("\n");

  return new NextResponse(md, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
