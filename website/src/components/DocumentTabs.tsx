"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface DocumentTabDef {
  type: string;
  label: string;
}

const TYPE_TO_ROUTE: Record<string, string> = {
  manual: "tsrm",
  ewd: "ewd",
  fixes: "fixes",
};

export default function DocumentTabs({
  documents,
  model,
}: {
  documents: DocumentTabDef[];
  model: string;
}) {
  const pathname = usePathname();

  return (
    <div
      style={{
        display: "flex",
        gap: "0",
        borderBottom: "1px solid rgba(72, 71, 77, 0.15)",
        marginTop: "6px",
      }}
    >
      {documents.filter((doc) => doc.type !== "fixes").map((doc) => {
        const route = TYPE_TO_ROUTE[doc.type] || doc.type;
        const href = `/${model}/${route}`;
        const isActive = pathname.startsWith(href);

        return (
          <Link
            key={doc.type}
            href={href}
            style={{
              padding: "8px 16px",
              fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
              fontWeight: 700,
              fontSize: "11px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              textDecoration: "none",
              color: isActive ? "var(--color-secondary)" : "var(--color-text-muted)",
              borderBottom: isActive
                ? "2px solid var(--color-secondary)"
                : "2px solid transparent",
              textShadow: isActive
                ? "0 0 8px rgba(0, 241, 253, 0.5)"
                : "none",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {doc.label}
          </Link>
        );
      })}
    </div>
  );
}
