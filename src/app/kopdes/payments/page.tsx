import type { Metadata } from "next";
import { PaymentsList } from "@/components/kopdes/payments-list";

export const metadata: Metadata = { title: "Payment Clock" };

export default function Page() {
  return <PaymentsList />;
}
