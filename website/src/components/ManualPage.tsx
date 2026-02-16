import { ManualContentBlock, PageData } from "@/types";
import DiagramViewer from "./DiagramViewer";
import TorqueSpec from "./TorqueSpec";
import CautionNotice from "./CautionNotice";
import ManualTable from "./ManualTable";

function renderListItem(item: unknown): string {
  if (typeof item === "string") return item;
  if (typeof item !== "object" || item === null) return String(item);
  const obj = item as Record<string, unknown>;
  const parts: string[] = [];
  if (obj.number) parts.push(String(obj.number));
  if (obj.heading) parts.push(String(obj.heading));
  if (obj.title) parts.push(String(obj.title));
  if (obj.text) parts.push(String(obj.text));
  if (obj.label) parts.push(String(obj.label));
  if (obj.description) parts.push(String(obj.description));
  if (obj.conclusion) parts.push(String(obj.conclusion));
  if (Array.isArray(obj.steps)) {
    for (const s of obj.steps) {
      parts.push(typeof s === "string" ? s : renderListItem(s));
    }
  }
  if (Array.isArray(obj.subitems)) {
    for (const sub of obj.subitems) {
      parts.push(renderListItem(sub));
    }
  }
  if (Array.isArray(obj.content)) {
    for (const c of obj.content) {
      parts.push(renderListItem(c));
    }
  }
  if (Array.isArray(obj.items)) {
    for (const i of obj.items) {
      parts.push(renderListItem(i));
    }
  }
  return parts.join(" — ") || JSON.stringify(item);
}

function renderBlock(block: ManualContentBlock, model: string, section: string, page: number, idx: number) {
  switch (block.type) {
    case "text":
      return (
        <p key={idx} className="my-2 text-gray-800 leading-relaxed">
          {block.text}
        </p>
      );

    case "heading":
      if (block.level <= 2) {
        return (
          <h2
            key={idx}
            className="text-xl font-bold text-gray-900 mt-6 mb-2 border-b border-gray-200 pb-1"
          >
            {block.text}
          </h2>
        );
      }
      return (
        <h3
          key={idx}
          className="text-lg font-semibold text-gray-900 mt-4 mb-1"
        >
          {block.text}
        </h3>
      );

    case "diagram": {
      const base = `/images/${model}/${section}/${section}_${String(page).padStart(3, "0")}_${block.index}`;
      return (
        <DiagramViewer
          key={idx}
          src={`${base}.svg`}
          fallbackSrc={`${base}.png`}
          alt={block.description}
          labels={block.labels}
        />
      );
    }

    case "caution":
      return <CautionNotice key={idx} type="caution" text={block.text} />;

    case "notice":
      return <CautionNotice key={idx} type="notice" text={block.text} />;

    case "table":
      return (
        <ManualTable
          key={idx}
          caption={block.caption}
          headers={block.headers}
          rows={block.rows}
        />
      );

    case "list":
      if (block.ordered) {
        return (
          <ol key={idx} className="my-2 ml-6 list-decimal text-gray-800 space-y-1">
            {block.items.map((item: unknown, i: number) => (
              <li key={i}>{renderListItem(item)}</li>
            ))}
          </ol>
        );
      }
      return (
        <ul key={idx} className="my-2 ml-6 list-disc text-gray-800 space-y-1">
          {block.items.map((item: unknown, i: number) => (
            <li key={i}>{renderListItem(item)}</li>
          ))}
        </ul>
      );

    case "torque_spec":
      return (
        <TorqueSpec
          key={idx}
          component={block.component}
          value={block.value}
        />
      );

    case "part_number":
      return (
        <div
          key={idx}
          className="my-2 inline-flex items-baseline gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-sm"
        >
          <span className="text-gray-600">{block.label}:</span>
          <span className="font-mono font-semibold text-red-700">
            {block.number}
          </span>
          {block.description && (
            <span className="text-gray-500">({block.description})</span>
          )}
        </div>
      );

    default:
      return null;
  }
}

export default function ManualPage({
  data,
  model,
  section,
  page,
}: {
  data: PageData;
  model: string;
  section: string;
  page: number;
}) {
  const pageImage = `/images/${model}/${section}/${section}_${String(page).padStart(3, "0")}.png`;
  const hasOcrText = !!data.ocr_text;
  const hasContent = data.content && data.content.length > 0;

  return (
    <article className="max-w-4xl">
      {data.section_header && (
        <p className="text-sm text-gray-500 mb-1">{data.section_header}</p>
      )}
      {data.title && (
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{data.title}</h1>
      )}

      {hasOcrText && !hasContent ? (
        <>
          <DiagramViewer
            src={pageImage}
            alt={data.title || "Manual page"}
          />
          <div className="sr-only" aria-hidden="false">
            {data.ocr_text}
          </div>
        </>
      ) : (
        <div>
          {data.content?.map((block, idx) =>
            renderBlock(block, model, section, page, idx)
          )}
        </div>
      )}
    </article>
  );
}
