import type { Metadata } from "next";
import { Suspense } from "react";
import { ManageView } from "@/components/manage/manage-view";

export const metadata: Metadata = { title: "Manage workspace" };

export default function Page() {
  return (
    <Suspense>
      <ManageView />
    </Suspense>
  );
}
