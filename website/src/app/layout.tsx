import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SectionSidebar from "@/components/SectionSidebar";
import SearchDialog from "@/components/SearchDialog";
import { SectionInfo } from "@/types";
import fs from "fs";
import path from "path";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TSRM — MK3 Toyota Supra Technical Service Repair Manual",
  description:
    "Modernized digital version of the 1990 MK3 Toyota Supra Technical Service Repair Manual",
};

function loadSections(): SectionInfo[] {
  const filePath = path.join(process.cwd(), "src", "content", "sections.json");
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const sections = loadSections();

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SectionSidebar sections={sections} />
        <div className="ml-64">
          <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-2 flex items-center justify-between">
            <div />
            <SearchDialog />
          </header>
          <main className="p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
