import { redirect } from "next/navigation";
import { getModelIds } from "@/lib/models";
import { getDocuments, getDocumentRoute } from "@/lib/documents";

export function generateStaticParams() {
  return getModelIds().map((model) => ({ model }));
}

export default async function ModelPage({
  params,
}: {
  params: Promise<{ model: string }>;
}) {
  const { model } = await params;
  const docs = getDocuments(model);
  const firstRoute = docs.length > 0 ? getDocumentRoute(docs[0]) : "tsrm";
  redirect(`/${model}/${firstRoute}`);
}
