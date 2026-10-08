import type { Metadata } from "next";
import { WhatsAppSimulator } from "@/components/farmer/whatsapp-sim";

export const metadata: Metadata = { title: "Farmer WhatsApp" };

export default function Page() {
  return <WhatsAppSimulator />;
}
