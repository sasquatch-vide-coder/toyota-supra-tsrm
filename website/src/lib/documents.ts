import { loadSections } from "./sections";

export interface DocumentDef {
  type: "manual" | "ewd";
  label: string;
  description: string;
  contentDir: string;
}

const MODEL_DOCUMENTS: Record<string, DocumentDef[]> = {
  mk3: [
    {
      type: "manual",
      label: "Repair Manual",
      description: "1990 Factory Service Manual",
      contentDir: "mk3",
    },
    {
      type: "ewd",
      label: "Wiring Diagrams",
      description: "EWD022U (USA-1987)",
      contentDir: "mk3-ewd",
    },
  ],
};

export function getDocuments(model: string): DocumentDef[] {
  const docs: DocumentDef[] = [];

  // Always include repair manual if content exists
  const manualSections = loadSections(model);
  if (manualSections.length > 0) {
    const custom = MODEL_DOCUMENTS[model]?.find((d) => d.type === "manual");
    docs.push(
      custom || {
        type: "manual",
        label: "Repair Manual",
        description: "Factory Service Manual",
        contentDir: model,
      }
    );
  }

  // Add any extra documents (EWD, etc.)
  const extras = MODEL_DOCUMENTS[model]?.filter((d) => d.type !== "manual") || [];
  for (const doc of extras) {
    const sections = loadSections(doc.contentDir);
    if (sections.length > 0) {
      docs.push(doc);
    }
  }

  return docs;
}
