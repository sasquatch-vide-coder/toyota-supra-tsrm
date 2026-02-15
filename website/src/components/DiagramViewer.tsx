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
      <figure className="my-4 border border-gray-200 rounded-lg overflow-hidden bg-white">
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
        <figcaption className="px-4 py-2 text-sm text-gray-600 border-t border-gray-100">
          {alt}
          {labels && labels.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {labels.map((label, i) => (
                <span
                  key={i}
                  className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded"
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
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setIsOpen(false)}
        >
          <img
            src={imgSrc}
            alt={alt}
            className="max-w-full max-h-full object-contain"
            onError={handleError}
          />
        </div>
      )}
    </>
  );
}
