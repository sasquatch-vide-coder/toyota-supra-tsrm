const colorMap = {
  red: "text-red-400",
  green: "text-green-400",
  blue: "text-blue-400",
  amber: "text-amber-400",
  gray: "text-gray-100",
} as const;

export function MetricCard({
  label,
  value,
  color = "gray",
}: {
  label: string;
  value: string | number;
  color?: keyof typeof colorMap;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
        {label}
      </p>
      <p className={`text-3xl font-bold font-mono ${colorMap[color]}`}>
        {value}
      </p>
    </div>
  );
}
