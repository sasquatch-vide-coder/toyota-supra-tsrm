import type { Metadata } from "next";
import { Space_Grotesk, Manrope } from "next/font/google";
import { TrackingBeacon } from "@/tracking/beacon";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
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
    "Toyota Supra factory service manuals — MK2 (5M/A60, 1982–1986), MK3 (7M/A70, 1986–1992), MK4 (2JZ/A80, 1993–2002). Searchable TSRM repair procedures, EWD wiring diagrams, torque specs, and community fixes. AI-upscaled scans, free, with offline ZIP downloads.",
  keywords: [
    "Toyota Supra",
    "service manual",
    "repair manual",
    "TSRM",
    "EWD",
    "wiring diagram",
    "MK2 Supra",
    "MK3 Supra",
    "MK4 Supra",
    "A60",
    "A70",
    "A80",
    "5M-GE",
    "7M-GTE",
    "2JZ-GE",
    "2JZ-GTE",
    "torque specs",
    "factory service manual",
  ],
  openGraph: {
    type: "website",
    siteName: "TSRM",
    locale: "en_US",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body
        className={`${spaceGrotesk.variable} ${manrope.variable} antialiased`}
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
