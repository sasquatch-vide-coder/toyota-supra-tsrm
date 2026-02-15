import { notFound } from "next/navigation";
import SectionSidebar from "@/components/SectionSidebar";
import SearchDialog from "@/components/SearchDialog";
import { loadSections } from "@/lib/sections";
import { getModel, getModelIds } from "@/lib/models";

export function generateStaticParams() {
  return getModelIds().map((model) => ({ model }));
}

export default async function ModelLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ model: string }>;
}) {
  const { model } = await params;
  const modelDef = getModel(model);
  if (!modelDef) notFound();

  const sections = loadSections(model);

  return (
    <>
      <SectionSidebar sections={sections} model={model} />
      <div className="ml-64">
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-2 flex items-center justify-between">
          <div />
          <SearchDialog model={model} />
        </header>
        <main className="p-6">{children}</main>
      </div>
    </>
  );
}
