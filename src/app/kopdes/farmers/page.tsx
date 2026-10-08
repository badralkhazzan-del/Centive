import type { Metadata } from "next";
import { Suspense } from "react";
import { FarmersList } from "@/components/kopdes/farmers-list";

export const metadata: Metadata = { title: "Farmers" };

export default function Page() {
  return (
    <Suspense>
      <FarmersList />
    </Suspense>
  );
}
