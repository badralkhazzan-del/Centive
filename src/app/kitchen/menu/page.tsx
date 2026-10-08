import type { Metadata } from "next";
import { MenuPlanner } from "@/components/kitchen/menu-planner";

export const metadata: Metadata = { title: "Menu Planner" };

export default function Page() {
  return <MenuPlanner />;
}
