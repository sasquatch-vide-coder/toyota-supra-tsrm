export interface ModelDef {
  id: string;
  name: string;
  make: string;
  year: string;
  generation: string;
  description: string;
}

export const MODELS: ModelDef[] = [
  {
    id: "mk4",
    name: "MK4 Supra",
    make: "Toyota",
    year: "1993–2002",
    generation: "A80",
    description:
      "Complete factory service manual — digitized from Toyota PDF",
  },
  {
    id: "mk3",
    name: "MK3 Supra",
    make: "Toyota",
    year: "1986.5–1992",
    generation: "A70",
    description: "Complete 1990 factory service manual — digitized from Toyota PDF",
  },
  {
    id: "mk2",
    name: "MK2 Supra",
    make: "Toyota",
    year: "1982–1986",
    generation: "A60",
    description: "Complete 1986 factory service manual — digitized from hand scans",
  },
];

export function getModel(id: string): ModelDef | undefined {
  return MODELS.find((m) => m.id === id);
}

export function getModelIds(): string[] {
  return MODELS.map((m) => m.id);
}
