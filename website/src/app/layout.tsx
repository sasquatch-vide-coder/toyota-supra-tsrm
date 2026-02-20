import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TrackingBeacon } from "@/tracking/beacon";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "TSRM — MK3 Toyota Supra Technical Service Repair Manual",
  description:
    "Modernized digital version of the 1990 MK3 Toyota Supra Technical Service Repair Manual",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <TrackingBeacon />
      </body>
    </html>
  );
}
