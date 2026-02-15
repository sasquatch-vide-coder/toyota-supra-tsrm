import SectionSidebar from "@/components/SectionSidebar";
import SearchDialog from "@/components/SearchDialog";
import { loadSections } from "@/lib/sections";

export default function ManualLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sections = loadSections();

  return (
    <>
      <SectionSidebar sections={sections} />
      <div className="ml-64">
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-2 flex items-center justify-between">
          <div />
          <SearchDialog />
        </header>
        <main className="p-6">{children}</main>
      </div>
    </>
  );
}
