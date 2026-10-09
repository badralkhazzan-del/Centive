import type { Metadata } from "next";
import { Suspense } from "react";
import { PrepareDelivery } from "@/components/kopdes/prepare-delivery";

export const metadata: Metadata = { title: "Prepare delivery" };

export default function Page() {
  return (
    <Suspense>
      <PrepareDelivery />
    </Suspense>
  );
}
