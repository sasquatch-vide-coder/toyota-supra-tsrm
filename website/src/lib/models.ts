export interface ModelDef {
  id: string;
  name: string;
  make: string;
  year: string;
  generation: string;
  description: string;
  /** US-market engines, for titles/descriptions. */
  engines: string;
  /** One-paragraph plain-language summary shown on the model hub page. */
  summary: string;
}

export const MODELS: ModelDef[] = [
  {
    id: "mk2",
    name: "MK2 Supra",
    make: "Toyota",
    year: "1982–1986",
    generation: "A60",
    description: "Complete 1986 factory service manual — digitized from hand scans",
    engines: "5M-GE",
    summary:
      "The second-generation Toyota Supra (Celica Supra, A60 chassis) was sold in North America from 1982 to 1986 with the 2.8L 5M-GE inline-six. This is the complete 1986 Toyota factory repair manual (TSRM) plus the 1985 electrical wiring diagram (EWD), scanned page by page, OCR-indexed, and free to browse or download.",
  },
  {
    id: "mk3",
    name: "MK3 Supra",
    make: "Toyota",
    year: "1986.5–1992",
    generation: "A70",
    description: "Complete 1990 factory service manual — digitized from Toyota PDF",
    engines: "7M-GE / 7M-GTE",
    summary:
      "The third-generation Toyota Supra (A70 chassis, 1986.5–1992) used the 3.0L 7M-GE inline-six and the turbocharged 7M-GTE. This is the complete 1990 Toyota factory repair manual (TSRM) — engine mechanical, EFI, turbo, transmission, brakes, body and electrical — plus the 1987 electrical wiring diagram (EWD) and a catalog of common problems with confirmed fixes from SupraForums.",
  },
  {
    id: "mk4",
    name: "MK4 Supra",
    make: "Toyota",
    year: "1993–2002",
    generation: "A80",
    description:
      "Complete factory service manual — digitized from Toyota PDF",
    engines: "2JZ-GE / 2JZ-GTE",
    summary:
      "The fourth-generation Toyota Supra (A80 chassis, 1993–2002; sold in the US 1993–1998) is powered by the 3.0L 2JZ-GE and the twin-turbo 2JZ-GTE inline-six. This is the complete Toyota factory repair manual (TSRM) covering the 2JZ engines, A340E/V160 transmissions, brakes, SRS, body and electrical, plus the 1995 electrical wiring diagram (EWD).",
  },
];

export function getModel(id: string): ModelDef | undefined {
  return MODELS.find((m) => m.id === id);
}

export function getModelIds(): string[] {
  return MODELS.map((m) => m.id);
}

/** "MK3 Supra" → "MK3", for phrases like "MK3 Toyota Supra". */
export function shortName(m: ModelDef): string {
  return m.name.replace(/\s+Supra$/, "");
}
