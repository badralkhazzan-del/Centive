import type { Metadata } from "next";
import { Suspense } from "react";
import { PhoneClaim } from "@/components/guest/phone-claim";

export const metadata: Metadata = { title: "Open on this phone" };

export default function Page() {
  return (
    <Suspense>
      <PhoneClaim />
    </Suspense>
  );
}
