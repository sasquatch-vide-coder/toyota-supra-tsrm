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
  metadataBase: new URL("https://tsrm.sasquatchvc.com"),
  title: {
    default: "TSRM — Toyota Supra Technical Service Repair Manual",
    template: "%s | TSRM",
  },
  description:
    "Complete factory service manuals for MK2, MK3, and MK4 Toyota Supra — digitized, AI-upscaled, and fully searchable.",
  openGraph: {
    type: "website",
    siteName: "TSRM",
    locale: "en_US",
    images: ["/supras.png"],
  },
  twitter: {
    card: "summary_large_image",
  },
  alternates: {
    canonical: "/",
  },
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "TSRM",
              url: "https://tsrm.sasquatchvc.com",
              description:
                "Complete factory service manuals for MK2, MK3, and MK4 Toyota Supra",
            }),
          }}
        />
        {children}
        <TrackingBeacon />
      </body>
    </html>
  );
}
