import fs from "fs";
import path from "path";
import SectionGrid from "@/components/SectionGrid";
import { SectionInfo } from "@/types";

function loadSections(): SectionInfo[] {
  const filePath = path.join(process.cwd(), "src", "content", "sections.json");
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return [];
  }
}

export default function HomePage() {
  const sections = loadSections();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          MK3 Toyota Supra — Technical Service Repair Manual
        </h1>
        <p className="text-gray-600">
          1990 Model Year &middot; Digitized and modernized from the original
          factory manual
        </p>
      </div>

      {sections.length > 0 ? (
        <SectionGrid sections={sections} />
      ) : (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-2">No content generated yet.</p>
          <p className="text-sm">
            Run{" "}
            <code className="bg-gray-100 px-2 py-1 rounded">
              python scripts/generate_content.py --all
            </code>{" "}
            to generate website content.
          </p>
        </div>
      )}
    </div>
  );
}
