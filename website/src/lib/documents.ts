import { loadSections } from "./sections";

export interface DocumentDef {
  type: "manual" | "ewd" | "fixes";
  label: string;
  description: string;
  contentDir: string;
}

const MODEL_DOCUMENTS: Record<string, DocumentDef[]> = {
  mk2: [
    {
      type: "manual",
      label: "Repair Manual",
      description: "1986 Factory Service Manual",
      contentDir: "mk2",
    },
    {
      type: "ewd",
      label: "Wiring Diagrams",
      description: "36705A (USA-1985)",
      contentDir: "mk2-ewd",
    },
  ],
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
    {
      type: "fixes",
      label: "Community Fixes",
      description: "Verified repairs from SupraForums",
      contentDir: "forum",
    },
  ],
  mk4: [
    {
      type: "ewd",
      label: "Wiring Diagrams",
      description: "EWD230U (USA-1995)",
      contentDir: "mk4-ewd",
    },
  ],
};

const TYPE_TO_ROUTE: Record<string, string> = {
  manual: "tsrm",
  ewd: "ewd",
  fixes: "fixes",
};

export function getDocumentRoute(doc: DocumentDef): string {
  return TYPE_TO_ROUTE[doc.type] || doc.type;
}

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

  // Add any extra documents (EWD, fixes, etc.)
  const extras = MODEL_DOCUMENTS[model]?.filter((d) => d.type !== "manual") || [];
  for (const doc of extras) {
    if (doc.type === "fixes") {
      // Fixes are database-driven, not filesystem-driven — always include
      docs.push(doc);
    } else {
      const sections = loadSections(doc.contentDir);
      if (sections.length > 0) {
        docs.push(doc);
      }
    }
  }

  return docs;
}
