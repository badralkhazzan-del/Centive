import type { Metadata } from "next";
import { PlateFeedbackView } from "@/components/kitchen/plate-feedback";

export const metadata: Metadata = { title: "Plate Feedback" };

export default function Page() {
  return <PlateFeedbackView />;
}
