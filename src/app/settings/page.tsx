import type { Metadata } from "next";
import { Suspense } from "react";
import { SettingsFallback, SettingsView } from "@/components/settings/settings-view";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return (
    <Suspense fallback={<SettingsFallback />}>
      <SettingsView />
    </Suspense>
  );
}
