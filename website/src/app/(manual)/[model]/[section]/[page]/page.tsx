import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";
import ManualPage from "@/components/ManualPage";
import PageNavigation from "@/components/PageNavigation";
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

export default async function ManualPageRoute({
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

  return (
    <div>
      <PageNavigation
        model={model}
        section={section}
        sectionName={sectionInfo.name}
        currentPage={pageNum}
        totalPages={sectionInfo.pages}
      />
      <ManualPage data={data} model={model} section={section} page={pageNum} />
    </div>
  );
}
