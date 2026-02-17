"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: "◈" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <div className="fixed inset-y-0 left-0 w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-4 border-b border-gray-800">
        <Link href="/admin" className="text-red-600 font-mono font-black text-xl">
          TSRM
        </Link>
        <p className="text-gray-500 text-xs mt-0.5">Admin</p>
      </div>

      <nav className="flex-1 py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                isActive
                  ? "text-white bg-gray-800 border-r-2 border-red-500"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          ← Back to site
        </Link>
      </div>
    </div>
  );
}
