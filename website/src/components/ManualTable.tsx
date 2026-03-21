function normalizeRow(row: unknown): string[] {
  if (Array.isArray(row)) return row.map((c) => String(c ?? ""));
  if (typeof row === "object" && row !== null) {
    return Object.values(row as Record<string, unknown>).map((v) => String(v ?? ""));
  }
  return [String(row ?? "")];
}

function normalizeHeaders(
  headers: unknown,
  rows: unknown[]
): string[] {
  if (Array.isArray(headers)) return headers.map((h) => String(h ?? ""));
  if (rows.length > 0 && typeof rows[0] === "object" && rows[0] !== null && !Array.isArray(rows[0])) {
    return Object.keys(rows[0] as Record<string, unknown>).map((k) =>
      k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    );
  }
  return [];
}

export default function ManualTable({
  caption,
  headers,
  rows,
}: {
  caption?: string;
  headers: string[];
  rows: string[][];
}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const safeHeaders = normalizeHeaders(headers, safeRows);
  const normalizedRows = safeRows.map(normalizeRow);

  return (
    <div className="my-4 overflow-x-auto">
      <table style={{ minWidth: "100%", borderCollapse: "collapse", fontSize: "14px", fontFamily: "'Manrope', var(--font-manrope), sans-serif" }}>
        {caption && (
          <caption style={{ textAlign: "left", fontSize: "13px", fontWeight: 600, color: "var(--color-text-muted)", marginBottom: "8px", fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif" }}>
            {caption}
          </caption>
        )}
        {safeHeaders.length > 0 && (
          <thead>
            <tr>
              {safeHeaders.map((h, i) => (
                <th
                  key={i}
                  style={{
                    padding: "8px 12px",
                    textAlign: "left",
                    fontWeight: 700,
                    color: "var(--color-secondary)",
                    background: "var(--color-surface-high)",
                    borderBottom: "1px solid var(--color-border)",
                    fontFamily: "'Space Grotesk', var(--font-space-grotesk), sans-serif",
                    fontSize: "11px",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    position: "sticky",
                    top: 0,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {normalizedRows.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: "1px solid var(--color-border-faint)" }}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  style={{
                    padding: "8px 12px",
                    color: "var(--color-text-muted)",
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
