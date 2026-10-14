"use client";

import Link from "next/link";
import { Building2, Sprout, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { useAppData, useLiveUser } from "@/lib/repo";

/**
 * A new live workspace has no kitchens, cooperatives or farmers yet. Role screens
 * then show what to add instead of an empty (or broken) screen.
 */
export function EntityGate({ kind, children }: { kind: "kitchen" | "kopdes" | "farmer"; children: React.ReactNode }) {
  const data = useAppData();
  const user = useLiveUser();
  const { t } = useT();
  const L = t.live;
  const missing = kind === "kitchen" ? data.kitchens.length === 0 : kind === "kopdes" ? data.kopdes.length === 0 : data.farmers.length === 0;
  const farmerUnlinked = kind === "farmer" && user?.role === "farmer" && !data.farmers.some((f) => f.id === user.entityId);
  if (!missing && !farmerUnlinked) return <>{children}</>;
  const Icon = kind === "kitchen" ? Building2 : kind === "kopdes" ? Store : Sprout;
  const title = kind === "kitchen" ? L.noKitchenTitle : kind === "kopdes" ? L.noKopdesTitle : L.noFarmerTitle;
  const body = farmerUnlinked ? L.farmerNotLinked : kind === "kitchen" ? L.noKitchenBody : kind === "kopdes" ? L.noKopdesBody : L.noFarmerBody;
  const canManage = user && user.role !== "farmer" && user.role !== "viewer";
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface p-8 text-center" data-testid={`empty-${kind}`}>
        <Icon className="size-10 text-primary" aria-hidden />
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-muted">{body}</p>
        {canManage ? (
          <Button asChild>
            <Link href={`/manage?tab=${kind === "kitchen" ? "kitchens" : kind === "kopdes" ? "kopdes" : "farmers"}`}>{L.goManage}</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
