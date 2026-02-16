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
  // Derive headers from first dict row
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
      <table className="min-w-full border-collapse border border-gray-300 text-sm">
        {caption && (
          <caption className="text-left text-sm font-medium text-gray-700 mb-2">
            {caption}
          </caption>
        )}
        {safeHeaders.length > 0 && (
          <thead>
            <tr className="bg-gray-100">
              {safeHeaders.map((h, i) => (
                <th
                  key={i}
                  className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-800 sticky top-0 bg-gray-100"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {normalizedRows.map((row, ri) => (
            <tr key={ri} className="hover:bg-gray-50">
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="border border-gray-300 px-3 py-2 text-gray-700"
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
