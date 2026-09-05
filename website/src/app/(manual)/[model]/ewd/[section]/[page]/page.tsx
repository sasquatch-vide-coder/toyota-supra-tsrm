import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadSections } from "@/lib/sections";
import { getModel, shortName } from "@/lib/models";
import { loadPage } from "@/lib/pages";
import { distinctPageTitle, ocrSnippet, stripLeading } from "@/lib/seo";
import EwdViewer from "@/components/EwdViewer";
import PageNavBar from "@/components/PageNavBar";

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

  const data = loadPage(`${model}-ewd`, section, pageNum);
  const pageTitle = data ? distinctPageTitle(data.title, data.section_header, sectionInfo.name) : "";
  const lead = `${shortName(modelDef)} Toyota Supra wiring diagram — ${sectionInfo.name}${pageTitle ? `: ${pageTitle}` : ""}, page ${pageNum}.`;
  const snippet = ocrSnippet(
    stripLeading(data?.ocr_text, [data?.section_header, sectionInfo.name, data?.title]),
    Math.max(40, 160 - lead.length)
  );
  const imageSrc = `/images/${model}-ewd/${section}/${section}_${String(pageNum).padStart(3, "0")}.png`;

  return {
    title: `${pageTitle ? `${pageTitle} — ` : ""}${sectionInfo.name} p.${pageNum} — ${modelDef.name} Wiring Diagram`,
    description: snippet ? `${lead} ${snippet}` : lead,
    alternates: {
      canonical: `/${model}/ewd/${section}/${pageNum}`,
      types: { "application/json": `/api/pages/${model}/ewd/${section}/${pageNum}` },
    },
    openGraph: { type: "article", images: [imageSrc] },
    twitter: { card: "summary_large_image", images: [imageSrc] },
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

  const data = loadPage(`${model}-ewd`, section, pageNum);
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
  const pageTitle = distinctPageTitle(data.title, data.section_header, sectionInfo.name);
  const headline = pageTitle || sectionInfo.name;
  const description = `${headline} — ${sectionInfo.name}, ${shortName(modelDef)} Toyota Supra electrical wiring diagram, page ${pageNum}`;

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <PageNavBar
          model={model}
          docType="ewd"
          section={section}
          sectionName={sectionInfo.name}
          pageNum={pageNum}
          totalPages={sectionInfo.pages}
          prevLink={prevLink}
          nextLink={nextLink}
          pageTitle={pageTitle}
        />

        <div style={{ flex: 1, minHeight: 0 }}>
          <EwdViewer
            src={imageSrc}
            alt={`${headline} — ${modelDef.name} ${sectionInfo.name} wiring diagram, page ${pageNum}`}
          />
        </div>
      </div>

      {/* OCR transcript — scroll below the viewer; indexable and copy/paste friendly */}
      {data.ocr_text && (
        <details className="ocr-text">
          <summary>Page text (OCR transcript)</summary>
          <pre>{data.ocr_text}</pre>
        </details>
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
                name: "Wiring Diagrams",
                item: `https://tsrm.sasquatchvc.com/${model}/ewd`,
              },
              {
                "@type": "ListItem",
                position: 4,
                name: sectionInfo.name,
                item: `https://tsrm.sasquatchvc.com/${model}/ewd/${section}`,
              },
              {
                "@type": "ListItem",
                position: 5,
                name: `Page ${pageNum}`,
              },
            ],
          }),
        }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "TechArticle",
            headline,
            name: `${sectionInfo.name} p.${pageNum} — ${modelDef.name} Wiring Diagram`,
            description,
            url: `https://tsrm.sasquatchvc.com/${model}/ewd/${section}/${pageNum}`,
            image: `https://tsrm.sasquatchvc.com${imageSrc}`,
            inLanguage: "en-US",
            isPartOf: {
              "@type": "Book",
              name: `${modelDef.name} Electrical Wiring Diagram`,
              url: `https://tsrm.sasquatchvc.com/${model}/ewd`,
              about: {
                "@type": "Vehicle",
                name: `Toyota Supra ${modelDef.generation}`,
                model: modelDef.generation,
                vehicleModelDate: modelDef.year,
                vehicleEngine: { "@type": "EngineSpecification", name: modelDef.engines },
                manufacturer: { "@type": "Organization", name: "Toyota" },
              },
            },
            articleSection: sectionInfo.name,
            publisher: {
              "@type": "Organization",
              name: "TSRM",
              url: "https://tsrm.sasquatchvc.com",
            },
          }),
        }}
      />
    </>
  );
}
