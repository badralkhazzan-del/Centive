"use client";

import { HydrationGate } from "@/components/common/gate";
import { KitchenSelector } from "@/components/common/selectors";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { formatNumber } from "@/engines/format";
import { useT } from "@/i18n";
import { useDerived } from "@/lib/repo";

export function KitchenShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { t, lang } = useT();
  const d = useDerived();
  const k = d.kitchensById.get(d.data.ui.activeKitchenId);
  return (
    <PageContainer>
      <PageHeader
        eyebrow={k ? `${k.name} · ${t.kitchen.beneficiaries(formatNumber(k.beneficiaries.small + k.beneficiaries.large, lang))}` : undefined}
        title={title}
        subtitle={subtitle}
        actions={
          <>
            {actions}
            <KitchenSelector />
          </>
        }
      />
      <HydrationGate>{children}</HydrationGate>
    </PageContainer>
  );
}
