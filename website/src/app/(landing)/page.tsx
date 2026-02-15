import Link from "next/link";
import SectionGrid from "@/components/SectionGrid";
import LandingSearchBar from "@/components/LandingSearchBar";
import { loadSections } from "@/lib/sections";

export default function LandingPage() {
  const sections = loadSections();
  const totalPages = sections.reduce((sum, s) => sum + s.pages, 0);

  return (
    <div className="min-h-screen">
      {/* ─── Hero ─── */}
      <section className="relative bg-gray-900 overflow-hidden">
        {/* Diagonal accent line */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-1/2 -right-1/4 w-[800px] h-[800px] bg-red-600/[0.04] rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-600/40 to-transparent" />
        </div>

        <div className="relative max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
          {/* Document code tag */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-8 border border-gray-700 rounded-full text-xs tracking-widest uppercase text-gray-500">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
            Technical Service Repair Manual
          </div>

          {/* Title block */}
          <h1 className="mb-4">
            <span className="block text-7xl sm:text-8xl font-black tracking-tighter text-red-600 font-mono">
              TSRM
            </span>
            <span className="block mt-3 text-xl sm:text-2xl font-light text-gray-300 tracking-wide">
              MK3 Toyota Supra
            </span>
          </h1>

          <p className="max-w-lg mx-auto text-gray-500 text-sm leading-relaxed mb-12">
            The complete 1990 factory service manual — digitized, searchable,
            and modernized. {sections.length} sections, {totalPages.toLocaleString()} pages
            of technical documentation at your fingertips.
          </p>

          {/* Search */}
          <LandingSearchBar />

          {/* Quick stats */}
          <div className="mt-12 flex items-center justify-center gap-8 sm:gap-12 text-gray-500">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-300 font-mono">{sections.length}</div>
              <div className="text-xs uppercase tracking-wider mt-0.5">Sections</div>
            </div>
            <div className="w-px h-8 bg-gray-700" />
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-300 font-mono">{totalPages.toLocaleString()}</div>
              <div className="text-xs uppercase tracking-wider mt-0.5">Pages</div>
            </div>
            <div className="w-px h-8 bg-gray-700" />
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-300 font-mono">1990</div>
              <div className="text-xs uppercase tracking-wider mt-0.5">Model Year</div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Section Grid ─── */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-1 h-8 bg-red-600 rounded-full" />
            <h2 className="text-2xl font-bold text-gray-900">Browse the Manual</h2>
          </div>

          {sections.length > 0 ? (
            <SectionGrid sections={sections} />
          ) : (
            <div className="text-center py-16 text-gray-500">
              <p className="text-lg mb-2">No content generated yet.</p>
              <p className="text-sm">
                Run{" "}
                <code className="bg-gray-100 px-2 py-1 rounded font-mono text-xs">
                  python scripts/generate_content.py --all
                </code>{" "}
                to generate website content.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ─── Community Forum CTA ─── */}
      <section className="bg-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="bg-gray-900 rounded-2xl p-8 sm:p-12 flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-12">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase bg-blue-500/20 text-blue-400 rounded tracking-wider">
                  Forum
                </span>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                Community Knowledge Base
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Search thousands of SupraForums threads — real-world diagnostics,
                fixes, and part numbers from MK3 owners. Integrated alongside
                the factory manual results.
              </p>
            </div>
            <Link
              href="/search"
              className="shrink-0 inline-flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/15 border border-white/10 text-white font-medium rounded-lg transition-colors"
            >
              Search Everything
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="bg-gray-900 border-t border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-red-600">TSRM</span>
            <span className="text-gray-700">|</span>
            <span>Digitized from the 1990 MK3 Toyota Supra factory service manual</span>
          </div>
          <div className="text-gray-700">
            Not affiliated with Toyota Motor Corporation
          </div>
        </div>
      </footer>
    </div>
  );
}
