"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { CircleCheck, Clock, ExternalLink, ScanLine, Search, Snowflake, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckboxRow } from "@/components/ui/checkbox";
import { Input, Label } from "@/components/ui/input";
import { IngredientLabel } from "@/components/common/ingredient";
import { PaymentStepper } from "@/components/common/payment-stepper";
import { useToast } from "@/components/common/toast";
import { formatDate, formatDateTime, formatKg, formatRp } from "@/engines/format";
import { useT } from "@/i18n";
import { actions, useDerived } from "@/lib/repo";
import { shortKopdesName } from "@/lib/names";
import { cn } from "@/lib/utils";
import { KitchenShell } from "./kitchen-shell";

export function ReceiveDelivery() {
  const { t } = useT();
  return (
    <KitchenShell title={t.kitchen.receive.title} subtitle={t.kitchen.receive.subtitle}>
      <ReceiveInner />
    </KitchenShell>
  );
}

function ReceiveInner() {
  const { t, lang } = useT();
  const d = useDerived();
  const params = useSearchParams();
  const notify = useToast();
  const initial = params.get("code") ?? "";
  const [code, setCode] = useState(initial);
  const [selected, setSelected] = useState<string | null>(initial ? initial.toUpperCase() : null);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [cold, setCold] = useState(false);
  const [receivedBy, setReceivedBy] = useState(t.kitchen.receive.receivedByDefault);
  const [done, setDone] = useState<string | null>(null);
  const [scanHint, setScanHint] = useState(false);

  const kitchenId = d.data.ui.activeKitchenId;
  const expected = d.data.batches
    .filter((b) => b.kitchenId === kitchenId && !b.deliveredAt)
    .sort((a, b) => a.plannedDeliveryDate.localeCompare(b.plannedDeliveryDate));
  const batch = selected ? d.data.batches.find((b) => b.id === selected) : undefined;
  const ing = batch ? d.ingredientsById.get(batch.ingredientId) : undefined;
  const needsCold = ing?.foodGroup === "animal_protein";
  const row = batch ? d.paymentRows.find((r) => r.payment.batchId === batch.id) : undefined;

  const pick = (id: string) => {
    setSelected(id);
    setCode(id);
    setError(null);
    setChecked(false);
    setCold(false);
    setDone(null);
  };
  const find = () => {
    const c = code.trim().toUpperCase();
    const b = d.data.batches.find((x) => x.id === c);
    if (!b) {
      setError(t.kitchen.receive.notFound);
      setSelected(null);
      return;
    }
    pick(b.id);
    if (b.deliveredAt) setError(t.kitchen.receive.alreadyReceived);
  };
  const confirm = () => {
    if (!batch) return;
    const r = actions.receiveBatch(batch.id, { receivedChecked: checked, coldChainChecked: cold, receivedBy });
    if (!r.ok) {
      setError(r.error === "already_received" ? t.kitchen.receive.alreadyReceived : r.error === "not_found" ? t.kitchen.receive.notFound : t.kitchen.receive.checksMissing);
      return;
    }
    setDone(batch.id);
    setError(null);
    notify(t.kitchen.receive.success);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="grid content-start gap-5">
        <Card>
          <CardContent className="grid gap-3 pt-5">
            <form
              className="grid gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                find();
              }}
            >
              <Label htmlFor="batch-code">{t.kitchen.receive.codeLabel}</Label>
              <div className="flex gap-2">
                <Input
                  id="batch-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder={t.kitchen.receive.codePlaceholder}
                  autoComplete="off"
                  className="font-mono text-lg tracking-wider"
                  data-testid="batch-code-input"
                />
                <Button type="submit" data-testid="find-batch" aria-label={t.kitchen.receive.find}>
                  <Search aria-hidden /> <span className="hidden sm:inline">{t.kitchen.receive.find}</span>
                </Button>
              </div>
            </form>
            <Button variant="outline" onClick={() => setScanHint(true)}>
              <ScanLine aria-hidden /> {t.kitchen.receive.scan}
            </Button>
            {scanHint ? <p className="text-sm text-muted">{t.kitchen.receive.scanSim}</p> : null}
            {error ? (
              <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-semibold text-danger-strong">
                {error}
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t.kitchen.receive.expected}</CardTitle>
          </CardHeader>
          <CardContent>
            {expected.length === 0 ? <p className="text-muted">{t.kitchen.receive.noExpected}</p> : null}
            <ul className="grid gap-2">
              {expected.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => pick(b.id)}
                    data-testid={`expected-${b.id}`}
                    className={cn(
                      "flex min-h-13 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left hover:bg-muted-surface focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
                      selected === b.id ? "border-primary bg-primary-soft" : "border-border",
                    )}
                  >
                    <Truck className="size-5 text-primary" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap gap-x-2 font-semibold">
                        <IngredientLabel ingredient={d.ingredientsById.get(b.ingredientId)} /> {formatKg(b.kg, lang)}
                      </span>
                      <span className="block text-sm text-muted">
                        {formatDate(b.plannedDeliveryDate, lang, { weekday: true })} · {shortKopdesName(d.kopdesById.get(b.kopdesId)?.name ?? "")}
                      </span>
                    </span>
                    <span className="font-mono text-sm font-bold">{b.id}</span>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div>
        {batch && ing ? (
          <Card className={done ? "border-ok" : undefined} data-tour="receive-card">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="font-mono text-2xl tracking-wider">{batch.id}</CardTitle>
                {batch.deliveredAt ? <Badge variant="green">{t.kopdes.delivery.received}</Badge> : <Badge variant="yellow">{t.kopdes.delivery.inTransit}</Badge>}
              </div>
              <div className="text-2xl font-bold">
                <IngredientLabel ingredient={ing} /> · {formatKg(batch.kg, lang)}
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-muted">{t.trace.grade}</dt>
                  <dd className="font-semibold">{batch.grade}</dd>
                </div>
                <div>
                  <dt className="text-muted">{t.trace.harvest}</dt>
                  <dd className="font-semibold">{formatDate(batch.harvestDate, lang, { weekday: true })}</dd>
                </div>
                <div>
                  <dt className="text-muted">{t.kitchen.receive.from}</dt>
                  <dd className="font-semibold">{d.kopdesById.get(batch.kopdesId)?.name}</dd>
                </div>
                <div>
                  <dt className="text-muted">{t.kitchen.receive.planned}</dt>
                  <dd className="font-semibold">{formatDate(batch.plannedDeliveryDate, lang, { weekday: true })}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-muted">{t.trace.farmers}</dt>
                  <dd className="font-semibold">
                    {batch.farmerIds
                      .map((id) => d.farmersById.get(id))
                      .filter(Boolean)
                      .map((f) => `${f!.displayName} (${f!.village})`)
                      .join(", ")}
                  </dd>
                </div>
                {needsCold ? (
                  <div className="col-span-2 flex items-center gap-2 text-sm">
                    <Snowflake className="size-4 text-primary" aria-hidden />
                    {t.trace.coldChain}: <span className="font-semibold">{batch.coldChainChecked ? t.trace.coldOk : t.trace.coldMissing}</span>
                  </div>
                ) : null}
              </dl>
              {done || batch.deliveredAt ? (
                <div className="grid gap-3 rounded-xl bg-ok-soft p-4 text-ok-strong" role="status">
                  <p className="flex items-center gap-2 text-lg font-bold">
                    <CircleCheck className="size-6" aria-hidden /> {t.kitchen.receive.success}
                  </p>
                  {batch.deliveredAt ? <p className="text-sm">{formatDateTime(batch.deliveredAt, lang)} · {batch.receivedBy}</p> : null}
                  {row ? (
                    <div className="grid gap-2 rounded-lg bg-surface p-3 text-foreground" data-tour="payment-clock" data-testid="receive-payment-clock">
                      <p className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="size-4 text-primary" aria-hidden /> {t.kopdes.payments.title}
                        </span>
                        <span className="tabular-nums">{formatRp(row.payment.amountRp, lang)}</span>
                      </p>
                      <PaymentStepper status={row.status} />
                      <p className="text-xs text-muted">
                        {row.status.waitingOn ? t.kopdes.payments.waiting[row.status.waitingOn] : ""} ·{" "}
                        {t.kopdes.payments.sla(d.kitchensById.get(batch.kitchenId)?.paymentSlaDays ?? d.data.settings.paymentSlaDays)}
                      </p>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/trace/${batch.id}`}>
                        <ExternalLink aria-hidden /> {t.kitchen.receive.viewTrace}
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-2">
                  <CheckboxRow id="chk-received" checked={checked} onChange={setChecked} testId="check-received">
                    {t.kitchen.receive.checkReceived}
                  </CheckboxRow>
                  {needsCold ? (
                    <CheckboxRow id="chk-cold" checked={cold} onChange={setCold} testId="check-cold">
                      {t.kitchen.receive.checkCold}
                    </CheckboxRow>
                  ) : null}
                  <div className="grid gap-1.5">
                    <Label htmlFor="received-by">{t.kitchen.receive.receivedBy}</Label>
                    <Input id="received-by" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} />
                  </div>
                  <Button size="lg" onClick={confirm} disabled={!checked || (needsCold && !cold)} data-testid="confirm-receipt" data-tour="receive-confirm">
                    <CircleCheck aria-hidden /> {t.kitchen.receive.confirm}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface p-8 text-center text-muted">
            <ScanLine className="size-10" aria-hidden />
            <p>{t.kitchen.receive.subtitle}</p>
          </div>
        )}
      </div>
    </div>
  );
}
