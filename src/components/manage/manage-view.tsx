"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Building2, Carrot, CookingPot, Settings2, Sprout, Store, Tag, Users, type LucideIcon } from "lucide-react";
import { HydrationGate } from "@/components/common/gate";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/i18n";
import { useLiveMode } from "@/lib/repo";
import { DishesTab } from "./dishes-tab";
import { FarmersTab } from "./farmers-tab";
import { IngredientsTab } from "./ingredients-tab";
import { KitchensTab } from "./kitchens-tab";
import { KopdesTab } from "./kopdes-tab";
import { usePermissions } from "./parts";
import { PricesTab } from "./prices-tab";
import { TeamTab } from "./team-tab";
import { PasswordCard, WorkspaceTab } from "./workspace-tab";

export const MANAGE_TABS = ["team", "kitchens", "kopdes", "farmers", "ingredients", "prices", "dishes", "workspace"] as const;
export type ManageTab = (typeof MANAGE_TABS)[number];

const ICONS: Record<ManageTab, LucideIcon> = {
  team: Users,
  kitchens: Building2,
  kopdes: Store,
  farmers: Sprout,
  ingredients: Carrot,
  prices: Tag,
  dishes: CookingPot,
  workspace: Settings2,
};

const PANELS: Record<ManageTab, () => React.ReactNode> = {
  team: () => <TeamTab />,
  kitchens: () => <KitchensTab />,
  kopdes: () => <KopdesTab />,
  farmers: () => <FarmersTab />,
  ingredients: () => <IngredientsTab />,
  prices: () => <PricesTab />,
  dishes: () => <DishesTab />,
  workspace: () => <WorkspaceTab />,
};

export function ManageView() {
  const { t } = useT();
  const live = useLiveMode();
  const perms = usePermissions();
  const params = useSearchParams();

  // Tabs each role can use. People and Workspace need a live (server) workspace.
  const visible = MANAGE_TABS.filter((tab) => {
    if (tab === "team") return live && (perms.isAdmin || perms.role === "kopdes");
    if (tab === "workspace") return live && perms.isAdmin;
    if (perms.isAdmin) return true;
    if (perms.role === "kitchen") return tab === "kitchens" || tab === "dishes" || tab === "ingredients";
    if (perms.role === "kopdes") return tab === "kopdes" || tab === "farmers" || tab === "prices" || tab === "ingredients";
    return false;
  });
  const parse = (raw: string | null): ManageTab => (visible as readonly string[]).includes(raw ?? "") ? (raw as ManageTab) : (visible[0] ?? "kitchens");
  const raw = params.get("tab");
  const [state, setState] = useState(() => ({ raw, tab: parse(raw) }));
  if (state.raw !== raw) setState({ raw, tab: parse(raw) });
  const tab = visible.includes(state.tab) ? state.tab : parse(null);

  const onTabChange = (value: string) => {
    const next = parse(value);
    setState((s) => ({ ...s, tab: next }));
    window.history.replaceState(null, "", `?tab=${next}`);
  };

  return (
    <PageContainer>
      <PageHeader title={t.manage.title} subtitle={t.manage.subtitle} />
      <HydrationGate>
        <Tabs value={tab} onValueChange={onTabChange}>
          <TabsList aria-label={t.manage.title} className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto sm:flex-wrap">
            {visible.map((key) => {
              const Icon = ICONS[key];
              return (
                <TabsTrigger key={key} value={key} className="min-h-11 px-3.5" data-testid={`manage-tab-${key}`}>
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span>{t.manage.tabs[key]}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
          {visible.map((key) => (
            <TabsContent key={key} value={key} className="mt-6">
              {key === tab ? PANELS[key]() : null}
            </TabsContent>
          ))}
        </Tabs>
        {live && !perms.isAdmin ? (
          <div className="mt-10 max-w-2xl">
            <PasswordCard />
          </div>
        ) : null}
      </HydrationGate>
    </PageContainer>
  );
}
