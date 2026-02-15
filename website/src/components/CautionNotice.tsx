export default function CautionNotice({
  type,
  text,
}: {
  type: "caution" | "notice";
  text: string;
}) {
  const styles = {
    caution: {
      bg: "bg-amber-50",
      border: "border-amber-400",
      title: "CAUTION",
      titleColor: "text-amber-700",
      textColor: "text-amber-900",
    },
    notice: {
      bg: "bg-blue-50",
      border: "border-blue-400",
      title: "NOTICE",
      titleColor: "text-blue-700",
      textColor: "text-blue-900",
    },
  };

  const s = styles[type];

  return (
    <div className={`my-3 px-4 py-3 ${s.bg} border-l-4 ${s.border} rounded-r`}>
      <p className={`text-xs font-bold ${s.titleColor} mb-1`}>{s.title}</p>
      <p className={`text-sm ${s.textColor}`}>{text}</p>
    </div>
  );
}
