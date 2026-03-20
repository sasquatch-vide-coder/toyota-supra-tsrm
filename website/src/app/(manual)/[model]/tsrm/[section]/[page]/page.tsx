import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadSections } from "@/lib/sections";
import { PageData } from "@/types";
import { getModel, getModelIds } from "@/lib/models";
import PageImage from "@/components/PageImage";

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ model: string; section: string; page: string }>;
}): Promise<Metadata> {
  const { model, section, page: pageStr } = await params;
  const modelDef = getModel(model);
  if (!modelDef) return {};

  const pageNum = parseInt(pageStr, 10);
  const sections = loadSections(model);
  const sectionInfo = sections.find((s) => s.code === section);
  if (!sectionInfo) return {};

  const data = loadPage(model, section, pageNum);
  const desc =
    data?.title && data.title !== data.section_header
      ? `${data.title} — ${sectionInfo.name}, ${modelDef.name} service manual`
      : `${sectionInfo.name} page ${pageNum} — ${modelDef.name} service manual`;

  return {
    title: `${sectionInfo.name} p.${pageNum} — ${modelDef.name} Manual`,
    description: desc,
    alternates: { canonical: `/${model}/tsrm/${section}/${pageNum}` },
  };
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
  const imageSrc = `/images/${model}/${section}/${section}_${paddedPage}.png`;
  return (
    <div className="page-container" style={{ padding: "32px", display: "flex", flexDirection: "column" }}>
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
        <Link href={`/${model}/tsrm`} style={{ color: "#8B7355", textDecoration: "none" }}>Repair Manual</Link>
        <span style={{ color: "#D4C9B8" }}>/</span>
        <Link href={`/${model}/tsrm/${section}`} style={{ color: "#8B7355", textDecoration: "none" }}>
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
            href={`/${model}/tsrm/${prevLink.section}/${prevLink.page}`}
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
            href={`/${model}/tsrm/${nextLink.section}/${nextLink.page}`}
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

      {/* Page image */}
      <PageImage
        imageSrc={imageSrc}
        alt={`${sectionInfo.name} page ${pageNum}`}
      />

      {/* Hidden OCR text for SEO */}
      {data.ocr_text && (
        <div
          aria-hidden="true"
          style={{ opacity: 0, position: "absolute", pointerEvents: "none", height: 0, overflow: "hidden" }}
        >
          {data.ocr_text}
        </div>
      )}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "TSRM",
                item: "https://tsrm.sasquatchvc.com",
              },
              {
                "@type": "ListItem",
                position: 2,
                name: modelDef.name,
                item: `https://tsrm.sasquatchvc.com/${model}`,
              },
              {
                "@type": "ListItem",
                position: 3,
                name: sectionInfo.name,
                item: `https://tsrm.sasquatchvc.com/${model}/tsrm/${section}`,
              },
              {
                "@type": "ListItem",
                position: 4,
                name: `Page ${pageNum}`,
              },
            ],
          }),
        }}
      />
    </div>
  );
}
