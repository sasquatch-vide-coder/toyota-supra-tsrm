import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadSections } from "@/lib/sections";
import { PageData } from "@/types";
import { getModel, getModelIds } from "@/lib/models";
import EwdViewer from "@/components/EwdViewer";
import PageNavBar from "@/components/PageNavBar";

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
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <PageNavBar
        model={model}
        docType="tsrm"
        section={section}
        sectionName={sectionInfo.name}
        pageNum={pageNum}
        totalPages={sectionInfo.pages}
        prevLink={prevLink}
        nextLink={nextLink}
      />

      {/* Page image viewer */}
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
