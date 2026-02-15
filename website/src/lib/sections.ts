import fs from "fs";
import path from "path";
import { SectionInfo } from "@/types";

export function loadSections(model: string): SectionInfo[] {
  const filePath = path.join(process.cwd(), "src", "content", model, "sections.json");
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return [];
  }
}
