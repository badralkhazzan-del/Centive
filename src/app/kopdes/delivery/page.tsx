import type { Metadata } from "next";
import { PrepareDelivery } from "@/components/kopdes/prepare-delivery";

export const metadata: Metadata = { title: "Prepare delivery" };

export default function Page() {
  return <PrepareDelivery />;
}
