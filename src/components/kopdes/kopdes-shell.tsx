"use client";

import { HydrationGate } from "@/components/common/gate";
import { KopdesSelector } from "@/components/common/selectors";
import { PageContainer } from "@/components/layout/page";

export function KopdesShell({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <PageContainer narrow>
      <div className="mb-5 grid grid-cols-1 gap-3">
        <KopdesSelector />
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
          {subtitle ? <div className="mt-1 text-muted">{subtitle}</div> : null}
        </div>
      </div>
      <HydrationGate rows={2}>{children}</HydrationGate>
    </PageContainer>
  );
}
