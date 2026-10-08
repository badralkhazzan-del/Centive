import type { Metadata } from "next";
import { Suspense } from "react";
import { ReceiveDelivery } from "@/components/kitchen/receive-delivery";

export const metadata: Metadata = { title: "Receive delivery" };

export default function Page() {
  return (
    <Suspense>
      <ReceiveDelivery />
    </Suspense>
  );
}
