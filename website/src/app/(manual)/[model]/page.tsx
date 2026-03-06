import { redirect } from "next/navigation";
import { getModelIds } from "@/lib/models";

export function generateStaticParams() {
  return getModelIds().map((model) => ({ model }));
}

export default async function ModelPage({
  params,
}: {
  params: Promise<{ model: string }>;
}) {
  const { model } = await params;
  redirect(`/${model}/tsrm`);
}
