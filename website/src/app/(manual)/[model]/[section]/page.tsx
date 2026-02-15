import Link from "next/link";
import { notFound } from "next/navigation";
import { loadSections } from "@/lib/sections";
import { getModel, getModelIds } from "@/lib/models";

export function generateStaticParams() {
  const params: { model: string; section: string }[] = [];
  for (const model of getModelIds()) {
    const sections = loadSections(model);
    for (const s of sections) {
      params.push({ model, section: s.code });
    }
  }
  return params;
}

export default async function SectionPage({
  params,
}: {
  params: Promise<{ model: string; section: string }>;
}) {
  const { model, section } = await params;
  if (!getModel(model)) notFound();

  const sections = loadSections(model);
  const sectionInfo = sections.find((s) => s.code === section);

  if (!sectionInfo) {
    notFound();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          <span className="text-red-600 font-mono mr-2">{section}</span>
          {sectionInfo.name}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {sectionInfo.pages} pages
        </p>
      </div>

      {sectionInfo.page_index && sectionInfo.page_index.length > 0 ? (
        <div className="space-y-1">
          {sectionInfo.page_index.map((p) => (
            <Link
              key={p.page}
              href={`/${model}/${section}/${p.page}`}
              className="block px-4 py-3 border border-gray-200 rounded-lg hover:border-red-300 hover:bg-red-50 transition-colors group"
            >
              <span className="font-mono text-sm text-gray-400 mr-3">
                {String(p.page).padStart(3, "0")}
              </span>
              <span className="text-gray-900 group-hover:text-red-700">
                {p.title || p.section_header || `Page ${p.page}`}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-gray-500">
          No pages generated for this section yet.
        </p>
      )}
    </div>
  );
}
