import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";
import ManualPage from "@/components/ManualPage";
import PageNavigation from "@/components/PageNavigation";
import { PageData, SectionInfo } from "@/types";

function loadSections(): SectionInfo[] {
  const filePath = path.join(process.cwd(), "src", "content", "sections.json");
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return [];
  }
}

function loadPage(section: string, page: number): PageData | null {
  const filePath = path.join(
    process.cwd(),
    "src",
    "content",
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
  const sections = loadSections();
  const params: { section: string; page: string }[] = [];
  for (const s of sections) {
    for (const p of s.page_index || []) {
      params.push({ section: s.code, page: String(p.page) });
    }
  }
  return params;
}

export default async function ManualPageRoute({
  params,
}: {
  params: Promise<{ section: string; page: string }>;
}) {
  const { section, page: pageStr } = await params;
  const pageNum = parseInt(pageStr, 10);

  const sections = loadSections();
  const sectionInfo = sections.find((s) => s.code === section);
  if (!sectionInfo) notFound();

  const data = loadPage(section, pageNum);
  if (!data) notFound();

  return (
    <div>
      <PageNavigation
        section={section}
        sectionName={sectionInfo.name}
        currentPage={pageNum}
        totalPages={sectionInfo.pages}
      />
      <ManualPage data={data} section={section} page={pageNum} />
    </div>
  );
}
