import type { Metadata } from "next";
import { RegencyDashboard } from "@/components/regency/regency-dashboard";

export const metadata: Metadata = { title: "Regency Impact Dashboard" };

export default function Page() {
  return <RegencyDashboard />;
}
