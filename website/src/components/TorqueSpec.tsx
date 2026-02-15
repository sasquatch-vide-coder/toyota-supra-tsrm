export default function TorqueSpec({
  component,
  value,
}: {
  component: string;
  value: string;
}) {
  return (
    <div className="my-2 flex items-baseline gap-3 px-4 py-2 bg-gray-50 border-l-4 border-red-500 rounded-r">
      <span className="font-medium text-gray-900">{component}</span>
      <span className="font-mono text-sm text-red-700">{value}</span>
    </div>
  );
}
