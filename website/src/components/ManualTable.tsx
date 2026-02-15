export default function ManualTable({
  caption,
  headers,
  rows,
}: {
  caption?: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="my-4 overflow-x-auto">
      <table className="min-w-full border-collapse border border-gray-300 text-sm">
        {caption && (
          <caption className="text-left text-sm font-medium text-gray-700 mb-2">
            {caption}
          </caption>
        )}
        <thead>
          <tr className="bg-gray-100">
            {headers.map((h, i) => (
              <th
                key={i}
                className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-800 sticky top-0 bg-gray-100"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
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
