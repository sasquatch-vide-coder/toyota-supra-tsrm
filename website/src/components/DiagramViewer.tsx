"use client";

import { useState } from "react";

interface DiagramViewerProps {
  src: string;
  fallbackSrc?: string;
  alt: string;
  labels?: string[];
  width?: number;
  height?: number;
}

export default function DiagramViewer({
  src,
  fallbackSrc,
  alt,
  labels,
}: DiagramViewerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [imgSrc, setImgSrc] = useState(src);

  const handleError = () => {
    if (fallbackSrc && imgSrc !== fallbackSrc) {
      setImgSrc(fallbackSrc);
    }
  };

  return (
    <>
      <figure
        className="my-4 rounded-lg overflow-hidden"
        style={{
          border: "1px solid var(--color-border)",
          background: "var(--color-surface-high)",
        }}
      >
        <button
          onClick={() => setIsOpen(true)}
          className="w-full cursor-zoom-in"
        >
          <img
            src={imgSrc}
            alt={alt}
            className="w-full h-auto"
            loading="lazy"
            onError={handleError}
          />
        </button>
        <figcaption
          className="px-4 py-2 text-sm"
          style={{
            color: "var(--color-text-muted)",
            borderTop: "1px solid var(--color-border-faint)",
          }}
        >
          {alt}
          {labels && labels.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {labels.map((label, i) => (
                <span
                  key={i}
                  className="inline-block px-2 py-0.5 text-xs rounded"
                  style={{
                    background: "var(--color-surface-highest)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </figcaption>
      </figure>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 cursor-zoom-out"
          style={{ background: "rgba(0,0,0,0.8)" }}
          onClick={() => setIsOpen(false)}
        >
          <img
            src={imgSrc}
            alt={alt}
            className="max-w-full max-h-full object-contain"
            style={{ border: "1px solid rgba(255,255,255,0.06)", borderRadius: "4px" }}
            onError={handleError}
          />
        </div>
      )}
    </>
  );
}
