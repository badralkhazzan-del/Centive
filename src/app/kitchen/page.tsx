import type { Metadata } from "next";
import { KitchenHome } from "@/components/kitchen/kitchen-home";

export const metadata: Metadata = { title: "Kitchen" };

export default function Page() {
  return <KitchenHome />;
}
