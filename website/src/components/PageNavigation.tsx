import Link from "next/link";

interface PageNavigationProps {
  section: string;
  sectionName: string;
  currentPage: number;
  totalPages: number;
}

export default function PageNavigation({
  section,
  sectionName,
  currentPage,
  totalPages,
}: PageNavigationProps) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-200 mb-4">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/" className="hover:text-red-600">
          Home
        </Link>
        <span>/</span>
        <Link href={`/${section}`} className="hover:text-red-600">
          {sectionName}
        </Link>
        <span>/</span>
        <span className="text-gray-900">Page {currentPage}</span>
      </div>

      <div className="flex gap-2">
        {currentPage > 1 && (
          <Link
            href={`/${section}/${currentPage - 1}`}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 hover:border-red-300 transition-colors"
          >
            Previous
          </Link>
        )}
        <Link
          href={`/compare/${section}/${currentPage}`}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-600 transition-colors"
        >
          Compare
        </Link>
        {currentPage < totalPages && (
          <Link
            href={`/${section}/${currentPage + 1}`}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 hover:border-red-300 transition-colors"
          >
            Next
          </Link>
        )}
      </div>
    </div>
  );
}
