"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AdminHeader({ email }: { email?: string }) {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-10 bg-gray-900/80 backdrop-blur border-b border-gray-800 px-6 py-3 flex items-center justify-between">
      <div />
      <div className="flex items-center gap-4">
        {email && (
          <span className="text-sm text-gray-400">{email}</span>
        )}
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
