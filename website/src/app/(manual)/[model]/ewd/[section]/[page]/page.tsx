import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadSections } from "@/lib/sections";
import { PageData } from "@/types";
import { getModel } from "@/lib/models";
import EwdViewer from "@/components/EwdViewer";

function loadPage(model: string, section: string, page: number): PageData | null {
  const filePath = path.join(
    process.cwd(),
    "src",
    "content",
    `${model}-ewd`,
    section,
    `${page}.json`
  );
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ model: string; section: string; page: string }>;
}): Promise<Metadata> {
  const { model, section, page: pageStr } = await params;
  const modelDef = getModel(model);
  if (!modelDef) return {};

  const pageNum = parseInt(pageStr, 10);
  const sections = loadSections(`${model}-ewd`);
  const sectionInfo = sections.find((s) => s.code === section);
  if (!sectionInfo) return {};

  const data = loadPage(model, section, pageNum);
  const desc =
    data?.title && data.title !== data.section_header
      ? `${data.title} — ${sectionInfo.name}, ${modelDef.name} wiring diagrams`
      : `${sectionInfo.name} page ${pageNum} — ${modelDef.name} wiring diagrams`;

  return {
    title: `${sectionInfo.name} p.${pageNum} — ${modelDef.name} EWD`,
    description: desc,
    alternates: { canonical: `/${model}/ewd/${section}/${pageNum}` },
  };
}

export default async function EwdPageRoute({
  params,
}: {
  params: Promise<{ model: string; section: string; page: string }>;
}) {
  const { model, section, page: pageStr } = await params;
  const modelDef = getModel(model);
  if (!modelDef) notFound();

  const pageNum = parseInt(pageStr, 10);
  const sections = loadSections(`${model}-ewd`);
  const sectionInfo = sections.find((s) => s.code === section);
  if (!sectionInfo) notFound();

  const data = loadPage(model, section, pageNum);
  if (!data) notFound();

  const pageIndex = sectionInfo.page_index || [];
  const currentIdx = pageIndex.findIndex((p) => p.page === pageNum);
  const prevPage = currentIdx > 0 ? pageIndex[currentIdx - 1].page : null;
  const nextPage = currentIdx < pageIndex.length - 1 ? pageIndex[currentIdx + 1].page : null;

  const currentSectionIdx = sections.findIndex((s) => s.code === section);

  let prevLink: { section: string; page: number; sectionName?: string } | null = null;
  let nextLink: { section: string; page: number; sectionName?: string } | null = null;

  if (prevPage !== null) {
    prevLink = { section, page: prevPage };
  } else if (currentSectionIdx > 0) {
    const prevSec = sections[currentSectionIdx - 1];
    const prevSecPages = prevSec.page_index || [];
    if (prevSecPages.length > 0) {
      prevLink = { section: prevSec.code, page: prevSecPages[prevSecPages.length - 1].page, sectionName: prevSec.name };
    }
  }

  if (nextPage !== null) {
    nextLink = { section, page: nextPage };
  } else if (currentSectionIdx < sections.length - 1) {
    const nextSec = sections[currentSectionIdx + 1];
    const nextSecPages = nextSec.page_index || [];
    if (nextSecPages.length > 0) {
      nextLink = { section: nextSec.code, page: nextSecPages[0].page, sectionName: nextSec.name };
    }
  }

  const paddedPage = String(pageNum).padStart(3, "0");
  const imageSrc = `/images/${model}-ewd/${section}/${section}_${paddedPage}.png`;
  return (
    <div className="page-container" style={{ padding: "32px", display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
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
        <Link href={`/${model}/ewd`} style={{ color: "#8B7355", textDecoration: "none" }}>EWD</Link>
        <span style={{ color: "#D4C9B8" }}>/</span>
        <Link href={`/${model}/ewd/${section}`} style={{ color: "#8B7355", textDecoration: "none" }}>
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
        {prevLink ? (
          <Link
            href={`/${model}/ewd/${prevLink.section}/${prevLink.page}`}
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
            ← {prevLink.sectionName || String(prevLink.page).padStart(3, "0")}
          </Link>
        ) : (
          <span />
        )}
        <span
          className="page-nav-label"
          style={{
            fontFamily: "monospace",
            fontSize: "11px",
            color: "#8B7355",
            letterSpacing: "0.15em",
          }}
        >
          {section} · {paddedPage}
        </span>
        {nextLink ? (
          <Link
            href={`/${model}/ewd/${nextLink.section}/${nextLink.page}`}
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
            {nextLink.sectionName || String(nextLink.page).padStart(3, "0")} →
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

      {/* Diagram viewer */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <EwdViewer
          src={imageSrc}
          alt={`${sectionInfo.name} page ${pageNum}`}
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
