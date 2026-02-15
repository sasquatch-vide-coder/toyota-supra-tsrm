import Link from "next/link";
import { SectionInfo } from "@/types";

const SECTION_DESCRIPTIONS: Record<string, string> = {
  IN: "Introduction",
  MA: "Maintenance",
  EM: "Engine Mechanical",
  EX: "Exhaust System",
  TC: "Turbocharging",
  EC: "Emission Control",
  FI: "Fuel Injection",
  CO: "Cooling System",
  LU: "Lubrication",
  IG: "Ignition",
  ST: "Starting & Charging",
  CH: "Clutch",
  CL: "Clutch (Hydraulic)",
  MT: "Manual Transmission",
  AT: "Automatic Transmission",
  PR: "Propeller Shaft",
  FA: "Front Axle",
  RA: "Rear Axle",
  BR: "Brakes",
  SR: "Steering",
  AB: "Supplemental Restraint",
  BE: "Body Electrical",
  BO: "Body",
  AC: "Air Conditioning",
  A: "Appendix A",
  B: "Appendix B",
  C: "Appendix C",
  D: "Appendix D",
};

export default function SectionGrid({ sections }: { sections: SectionInfo[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {sections.map((section) => (
        <Link
          key={section.code}
          href={`/${section.code}`}
          className="block border border-gray-200 rounded-lg p-4 hover:border-red-500 hover:shadow-md transition-all group"
        >
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-lg font-bold text-red-600 font-mono">
              {section.code}
            </span>
            <span className="text-sm text-gray-500">
              {section.pages} pages
            </span>
          </div>
          <h3 className="font-medium text-gray-900 group-hover:text-red-700 transition-colors">
            {section.name || SECTION_DESCRIPTIONS[section.code] || section.code}
          </h3>
        </Link>
      ))}
    </div>
  );
}
