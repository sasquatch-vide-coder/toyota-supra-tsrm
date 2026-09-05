import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Page scans are 1280px-wide PNGs (120KB–1.4MB). Serve resized WebP via next/image.
    formats: ["image/webp"],
    qualities: [85],
    deviceSizes: [640, 828, 1080, 1280],
    // Source files are immutable static scans — keep optimized variants for a year.
    minimumCacheTTL: 60 * 60 * 24 * 365,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
