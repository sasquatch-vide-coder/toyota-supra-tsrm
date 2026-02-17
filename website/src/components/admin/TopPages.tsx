export function TopPages({
  pages,
}: {
  pages: { path: string; views: number }[];
}) {
  if (!pages.length) {
    return <p className="text-gray-500 text-sm">No data yet</p>;
  }

  const maxViews = pages[0].views;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-4">
        Top Pages
      </h3>
      <div className="space-y-2">
        {pages.map((page, i) => (
          <div key={page.path} className="flex items-center gap-3">
            <span className="text-xs text-gray-600 w-5 text-right font-mono">
              {i + 1}
            </span>
            <div className="flex-1 relative">
              <div
                className="absolute inset-y-0 left-0 bg-red-600/15 rounded"
                style={{ width: `${(page.views / maxViews) * 100}%` }}
              />
              <span className="relative text-sm text-gray-300 font-mono px-2 py-0.5 block truncate">
                {page.path}
              </span>
            </div>
            <span className="text-sm text-gray-400 font-mono tabular-nums w-12 text-right">
              {page.views}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
