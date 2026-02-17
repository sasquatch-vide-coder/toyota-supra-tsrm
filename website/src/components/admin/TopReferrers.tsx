function stripProtocol(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function TopReferrers({
  referrers,
}: {
  referrers: { referrer: string; count: number }[];
}) {
  if (!referrers.length) {
    return <p className="text-gray-500 text-sm">No referrers yet</p>;
  }

  const maxCount = referrers[0].count;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-4">
        Top Referrers
      </h3>
      <div className="space-y-2">
        {referrers.map((ref, i) => (
          <div key={ref.referrer} className="flex items-center gap-3">
            <span className="text-xs text-gray-600 w-5 text-right font-mono">
              {i + 1}
            </span>
            <div className="flex-1 relative">
              <div
                className="absolute inset-y-0 left-0 bg-blue-600/15 rounded"
                style={{ width: `${(ref.count / maxCount) * 100}%` }}
              />
              <span className="relative text-sm text-gray-300 font-mono px-2 py-0.5 block truncate">
                {stripProtocol(ref.referrer)}
              </span>
            </div>
            <span className="text-sm text-gray-400 font-mono tabular-nums w-12 text-right">
              {ref.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
