import type { Metadata } from "next";
import { Suspense } from "react";
import { TraceView } from "@/components/trace/trace-view";

export const metadata: Metadata = { title: "Batch trace" };

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-8">
      <Suspense>
        <TraceView />
      </Suspense>
    </div>
  );
}
