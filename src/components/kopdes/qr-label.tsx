"use client";

import { QRCodeSVG } from "qrcode.react";
import { useSyncExternalStore } from "react";
import { Printer } from "lucide-react";
import type { Batch } from "@/types";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { formatDate, formatKg } from "@/engines/format";
import { useT } from "@/i18n";
import { useDerived } from "@/lib/repo";
import { shortKopdesName } from "@/lib/names";
import { traceUrl } from "@/lib/trace";

const subscribeNoop = () => () => undefined;

export function QrLabel({ batch }: { batch: Batch }) {
  const { t, lang, nm } = useT();
  const d = useDerived();
  const origin = useSyncExternalStore(subscribeNoop, () => window.location.origin, () => "");
  const url = traceUrl(origin, batch, d.farmersById);
  const ing = d.ingredientsById.get(batch.ingredientId);
  return (
    <div className="grid gap-3">
      <div id="qr-label" className="print-label mx-auto grid w-full max-w-sm gap-3 rounded-2xl border-2 border-foreground bg-white p-5 text-foreground" data-testid="qr-label">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 font-extrabold text-primary-strong">
            <LogoMark className="size-7" /> PiringTani
          </span>
          <span className="text-xs font-bold uppercase tracking-wide text-muted">{t.kopdes.delivery.labelTitle}</span>
        </div>
        <div className="flex items-center gap-4">
          <QRCodeSVG value={url} size={132} level="M" marginSize={1} title={batch.id} />
          <div className="grid gap-1">
            <span className="font-mono text-2xl font-extrabold tracking-wider" data-testid="label-code">
              {batch.id}
            </span>
            <span className="text-lg font-bold">
              {nm(ing)} · {formatKg(batch.kg, lang)}
            </span>
            <span className="text-sm">
              {t.trace.grade} {batch.grade} · {t.trace.harvest}: {formatDate(batch.harvestDate, lang)}
            </span>
          </div>
        </div>
        <div className="grid gap-0.5 border-t border-border pt-2 text-sm">
          <span>
            {shortKopdesName(d.kopdesById.get(batch.kopdesId)?.name ?? "")} → {d.kitchensById.get(batch.kitchenId)?.name}
          </span>
          <span className="text-muted">
            {t.kopdes.delivery.date}: {formatDate(batch.plannedDeliveryDate, lang, { weekday: true })}
            {ing?.foodGroup === "animal_protein" ? ` · ${t.trace.coldChain}: ${batch.coldChainChecked ? t.trace.coldOk : t.trace.coldMissing}` : ""}
          </span>
          <span className="text-xs text-muted">{t.kopdes.delivery.scanHint}</span>
        </div>
      </div>
      <Button variant="outline" onClick={() => window.print()} className="no-print mx-auto">
        <Printer aria-hidden /> {t.kopdes.delivery.printLabel}
      </Button>
    </div>
  );
}
