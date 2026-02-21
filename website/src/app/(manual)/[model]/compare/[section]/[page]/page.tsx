import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CompareView from "@/components/CompareView";
import { PageData } from "@/types";
import { loadSections } from "@/lib/sections";
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

  return {
    title: `Compare: ${sectionInfo.name} p.${pageNum} — ${modelDef.name}`,
    robots: { index: false, follow: true },
  };
}

export default async function ComparePage({
  params,
}: {
  params: Promise<{ model: string; section: string; page: string }>;
}) {
  const { model, section, page: pageStr } = await params;
  if (!getModel(model)) notFound();

  const pageNum = parseInt(pageStr, 10);

  const sections = loadSections(model);
  const sectionInfo = sections.find((s) => s.code === section);
  if (!sectionInfo) notFound();

  const data = loadPage(model, section, pageNum);
  if (!data) notFound();

  const basePath = `/originals/${model}/${section}/${section}_${String(pageNum).padStart(3, "0")}`;
  const gifExists = fs.existsSync(path.join(process.cwd(), "public", `${basePath}.gif`));
  const originalSrc = `${basePath}.${gifExists ? "gif" : "png"}`;

  return (
    <CompareView
      model={model}
      section={section}
      sectionName={sectionInfo.name}
      page={pageNum}
      totalPages={sectionInfo.pages}
      data={data}
      originalSrc={originalSrc}
    />
  );
}
