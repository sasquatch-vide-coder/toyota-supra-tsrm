import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex">
      <AdminSidebar />
      <div className="flex-1 ml-56">
        <AdminHeader email={user.email} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
