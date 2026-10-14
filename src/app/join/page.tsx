import type { Metadata } from "next";
import { Suspense } from "react";
import { JoinForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Join a workspace" };

export default function Page() {
  return (
    <Suspense>
      <JoinForm />
    </Suspense>
  );
}
