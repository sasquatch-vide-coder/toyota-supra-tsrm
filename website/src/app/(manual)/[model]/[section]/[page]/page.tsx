import fs from "fs";
import path from "path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadSections } from "@/lib/sections";
import { PageData } from "@/types";
import { getModel, getModelIds } from "@/lib/models";

function loadPage(model: string, section: string, page: number): PageData | null {
  const filePath = path.join(
    process.cwd(),
    "src",
    "content",
    model,
    section,
    `${page}.json`
  );
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

// Return empty array — pages are rendered on-demand and cached as static HTML.
// This avoids pre-rendering ~5,200 pages on every build.
export function generateStaticParams() {
  return [];
}

export default async function ManualPageRoute({
  params,
}: {
  params: Promise<{ model: string; section: string; page: string }>;
}) {
  const { model, section, page: pageStr } = await params;
  const modelDef = getModel(model);
  if (!modelDef) notFound();

  const pageNum = parseInt(pageStr, 10);
  const sections = loadSections(model);
  const sectionInfo = sections.find((s) => s.code === section);
  if (!sectionInfo) notFound();

  const data = loadPage(model, section, pageNum);
  if (!data) notFound();

  const pageIndex = sectionInfo.page_index || [];
  const currentIdx = pageIndex.findIndex((p) => p.page === pageNum);
  const prevPage = currentIdx > 0 ? pageIndex[currentIdx - 1].page : null;
  const nextPage = currentIdx < pageIndex.length - 1 ? pageIndex[currentIdx + 1].page : null;

  const paddedPage = String(pageNum).padStart(3, "0");
  const imageSrc = `/images/${model}/${section}/${section}_${paddedPage}.png`;

  return (
    <div style={{ padding: "32px", display: "flex", flexDirection: "column" }}>
      {/* Breadcrumb */}
      <div
        style={{
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#8B7355",
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        <Link href="/" style={{ color: "#8B7355", textDecoration: "none" }}>TSRM</Link>
        <span style={{ color: "#D4C9B8" }}>/</span>
        <Link href={`/${model}`} style={{ color: "#8B7355", textDecoration: "none" }}>{modelDef.name}</Link>
        <span style={{ color: "#D4C9B8" }}>/</span>
        <Link href={`/${model}/${section}`} style={{ color: "#8B7355", textDecoration: "none" }}>
          {sectionInfo.name}
        </Link>
        <span style={{ color: "#D4C9B8" }}>/</span>
        <span style={{ color: "#1A1A1A" }}>p.{pageNum}</span>
      </div>

      {/* Prev / Next bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        {prevPage !== null ? (
          <Link
            href={`/${model}/${section}/${prevPage}`}
            style={{
              fontFamily: "monospace",
              fontSize: "12px",
              color: "#F5F0E8",
              background: "#C41E3A",
              padding: "8px 16px",
              textDecoration: "none",
              letterSpacing: "0.1em",
            }}
          >
            ← {String(prevPage).padStart(3, "0")}
          </Link>
        ) : (
          <span />
        )}
        <span
          style={{
            fontFamily: "monospace",
            fontSize: "11px",
            color: "#8B7355",
            letterSpacing: "0.15em",
          }}
        >
          {section} · {paddedPage}
        </span>
        {nextPage !== null ? (
          <Link
            href={`/${model}/${section}/${nextPage}`}
            style={{
              fontFamily: "monospace",
              fontSize: "12px",
              color: "#F5F0E8",
              background: "#C41E3A",
              padding: "8px 16px",
              textDecoration: "none",
              letterSpacing: "0.1em",
            }}
          >
            {String(nextPage).padStart(3, "0")} →
          </Link>
        ) : (
          <span />
        )}
      </div>

      {/* Racing divider stripe */}
      <div style={{ display: "flex", height: "4px", marginBottom: "24px" }}>
        <div style={{ flex: 6, background: "#C41E3A" }} />
        <div style={{ flex: 1, background: "#1A1A1A" }} />
        <div style={{ flex: 3, background: "#8B7355" }} />
      </div>

      {/* Page image */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={`${sectionInfo.name} page ${pageNum}`}
          style={{
            maxWidth: "100%",
            border: "1px solid #D4C9B8",
            boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
            background: "#FFFFFF",
            display: "block",
          }}
        />
      </div>

      {/* Hidden OCR text for SEO */}
      {data.ocr_text && (
        <div
          aria-hidden="true"
          style={{ opacity: 0, position: "absolute", pointerEvents: "none", height: 0, overflow: "hidden" }}
        >
          {data.ocr_text}
        </div>
      )}
    </div>
  );
}
