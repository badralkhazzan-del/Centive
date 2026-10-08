import type { Metadata } from "next";
import { SwitchInbox } from "@/components/kitchen/switch-inbox";

export const metadata: Metadata = { title: "Menu Switch" };

export default function Page() {
  return <SwitchInbox />;
}
