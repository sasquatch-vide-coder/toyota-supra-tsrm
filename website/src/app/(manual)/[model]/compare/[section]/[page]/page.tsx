import fs from "fs";
import path from "path";
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

export function generateStaticParams() {
  const params: { model: string; section: string; page: string }[] = [];
  for (const model of getModelIds()) {
    const sections = loadSections(model);
    for (const s of sections) {
      for (const p of s.page_index || []) {
        params.push({ model, section: s.code, page: String(p.page) });
      }
    }
  }
  return params;
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

  const originalSrc = `/originals/${model}/${section}/${section}_${String(pageNum).padStart(3, "0")}.gif`;

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
