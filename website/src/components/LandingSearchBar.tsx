"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LandingSearchBar({ model }: { model: string }) {
  const [query, setQuery] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length >= 2) {
      router.push(`/${model}/search?q=${encodeURIComponent(trimmed)}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="relative">
        <svg
          className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the manual — e.g. fuel injector, torque specs, timing belt..."
          className="w-full pl-14 pr-32 py-4 text-lg bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-gray-400 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
        >
          Search
        </button>
      </div>
    </form>
  );
}
