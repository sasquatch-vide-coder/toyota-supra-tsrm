import type { Metadata } from "next";
import StatsClient from "./StatsClient";

export const metadata: Metadata = {
  title: "Site Stats",
  robots: { index: false, follow: false },
};

export default function StatsPage() {
  return <StatsClient />;
}
