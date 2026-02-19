import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopBar } from "@/components/admin/AdminTopBar";

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
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "#F5F0E8",
      }}
    >
      {/* Racing stripe */}
      <div style={{ display: "flex", height: "10px", flexShrink: 0 }}>
        <div style={{ flex: 1, background: "#1A1A1A" }} />
        <div style={{ flex: 1, background: "#C41E3A" }} />
        <div style={{ flex: 1, background: "#F5F0E8", borderTop: "1px solid #D4C9B8" }} />
      </div>

      {/* Top nav bar */}
      <AdminTopBar email={user.email} />

      {/* Body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <AdminSidebar />
        <main
          style={{
            flex: 1,
            overflowY: "auto",
            background: "#F5F0E8",
            padding: "32px",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
