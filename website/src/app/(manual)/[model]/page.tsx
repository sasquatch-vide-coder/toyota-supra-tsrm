import { notFound } from "next/navigation";
import SectionGrid from "@/components/SectionGrid";
import LandingSearchBar from "@/components/LandingSearchBar";
import { loadSections } from "@/lib/sections";
import { getModel, getModelIds } from "@/lib/models";

export function generateStaticParams() {
  return getModelIds().map((model) => ({ model }));
}

export default async function ModelLandingPage({
  params,
}: {
  params: Promise<{ model: string }>;
}) {
  const { model } = await params;
  const modelDef = getModel(model);
  if (!modelDef) notFound();

  const sections = loadSections(model);
  const totalPages = sections.reduce((sum, s) => sum + s.pages, 0);

  return (
    <div>
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-4 border border-gray-200 rounded-full text-xs tracking-widest uppercase text-gray-500">
          <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
          {modelDef.year} {modelDef.name}
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {modelDef.name} Technical Service Repair Manual
        </h1>
        <p className="text-gray-500">
          {modelDef.description}. {sections.length} sections, {totalPages.toLocaleString()} pages.
        </p>
      </div>

      <div className="mb-8 max-w-2xl">
        <LandingSearchBar model={model} />
      </div>

      <div className="flex items-center gap-8 mb-8 text-gray-500">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900 font-mono">{sections.length}</div>
          <div className="text-xs uppercase tracking-wider mt-0.5">Sections</div>
        </div>
        <div className="w-px h-8 bg-gray-200" />
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900 font-mono">{totalPages.toLocaleString()}</div>
          <div className="text-xs uppercase tracking-wider mt-0.5">Pages</div>
        </div>
        <div className="w-px h-8 bg-gray-200" />
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900 font-mono">{modelDef.year}</div>
          <div className="text-xs uppercase tracking-wider mt-0.5">Model Years</div>
        </div>
      </div>

      {sections.length > 0 ? (
        <SectionGrid sections={sections} model={model} />
      ) : (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-2">No content generated yet.</p>
          <p className="text-sm">
            Run{" "}
            <code className="bg-gray-100 px-2 py-1 rounded font-mono text-xs">
              python scripts/generate_content.py --model {model} --all
            </code>{" "}
            to generate website content.
          </p>
        </div>
      )}
    </div>
  );
}
