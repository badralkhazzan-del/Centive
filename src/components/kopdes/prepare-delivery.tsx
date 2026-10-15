"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PackagePlus, QrCode } from "lucide-react";
import type { Batch } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckboxRow } from "@/components/ui/checkbox";
import { Input, Label, Select } from "@/components/ui/input";
import { IngredientLabel } from "@/components/common/ingredient";
import { useToast } from "@/components/common/toast";
import { formatDate, formatKg } from "@/engines/format";
import { addDays } from "@/engines/time";
import { useT } from "@/i18n";
import { deliveryPool, nextSchoolDays, suggestedBatchKg } from "@/lib/delivery";
import { actions, useDerived } from "@/lib/repo";
import { cn } from "@/lib/utils";
import { KopdesShell } from "./kopdes-shell";
import { QrLabel } from "./qr-label";

export function PrepareDelivery() {
  const { t, lang, nm } = useT();
  const d = useDerived();
  const notify = useToast();
  const kd = d.kopdesById.get(d.data.ui.activeKopdesId)!;
  const L = t.kopdes.delivery;
  const accepted = d.data.commitments.filter((c) => c.kopdesId === kd.id && (c.status === "accepted" || c.status === "partially_fulfilled"));
  const ingredients = [...new Set(accepted.map((c) => c.ingredientId))].sort(
    (a, b) => d.data.ingredients.findIndex((i) => i.id === a) - d.data.ingredients.findIndex((i) => i.id === b),
  );
  const kitchens = d.data.kitchens.filter((k) => k.linkedKopdesIds.includes(kd.id));
  const dates = nextSchoolDays(addDays(d.today, 1), 4);

  const [ingredientId, setIngredientId] = useState(ingredients.includes("eggs") ? "eggs" : (ingredients[0] ?? ""));
  const [kitchenId, setKitchenId] = useState(kitchens[0]?.id ?? "");
  const [date, setDate] = useState(dates[0]);
  const [grade, setGrade] = useState<"A" | "B">("A");
  const [cold, setCold] = useState(false);
  const [created, setCreated] = useState<Batch | null>(null);
  const router = useRouter();
  const labelCode = useSearchParams().get("label")?.toUpperCase();
  const [lastKopdes, setLastKopdes] = useState(kd.id);
  if (lastKopdes !== kd.id) {
    setLastKopdes(kd.id);
    setIngredientId(ingredients[0] ?? "");
    setKitchenId(kitchens[0]?.id ?? "");
    setCreated(null);
  }

  const pool = deliveryPool(d, kd.id, ingredientId, date);
  const [selected, setSelected] = useState<string[] | null>(null);
  const chosen = selected ?? pool.map((p) => p.farmerId);
  const ing = d.ingredientsById.get(ingredientId);
  const needsCold = ing?.foodGroup === "animal_protein";
  const kitchen = d.kitchensById.get(kitchenId);
  const suggestedKg = suggestedBatchKg(d, kd.id, kitchenId, ingredientId, date, pool, chosen);
  const [kgInput, setKgInput] = useState<string>("");
  const kg = kgInput === "" ? suggestedKg : Math.max(0, Number(kgInput) || 0);

  const recent = d.data.batches
    .filter((b) => b.kopdesId === kd.id)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  const generate = () => {
    if (!ing || !kitchen || chosen.length === 0 || (needsCold && !cold) || kg <= 0) return;
    const batch = actions.createBatch({
      kopdesId: kd.id,
      kitchenId: kitchen.id,
      ingredientId,
      farmerIds: chosen,
      kg,
      grade,
      coldChainChecked: needsCold ? cold : false,
      harvestDate: addDays(date, -1),
      plannedDeliveryDate: date,
    });
    setCreated(batch);
    notify(L.created(batch.id));
  };

  // ?label=CODE shows the label of an existing batch (used by shared links).
  const shown = created ?? d.data.batches.find((b) => b.id === labelCode && b.kopdesId === kd.id) ?? null;

  const resetForm = () => {
    if (labelCode) router.replace("/kopdes/delivery");
    setCreated(null);
    setSelected(null);
    setKgInput("");
    setCold(false);
  };

  return (
    <KopdesShell title={L.title} subtitle={L.subtitle}>
      <div className="grid grid-cols-1 gap-5">
        {shown ? (
          <Card className="border-ok" data-tour="qr-label">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="size-5 text-primary" aria-hidden /> {L.labelTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <QrLabel batch={d.data.batches.find((b) => b.id === shown.id) ?? shown} />
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="secondary" asChild>
                  <Link href={`/trace/${shown.id}`}>{t.kitchen.receive.viewTrace}</Link>
                </Button>
                <Button variant="ghost" onClick={resetForm}>
                  <PackagePlus aria-hidden /> {L.newBatch}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="grid gap-4 pt-5">
              <div className="grid gap-1.5">
                <Label htmlFor="d-ing">{L.ingredient}</Label>
                <Select
                  id="d-ing"
                  value={ingredientId}
                  onChange={(e) => {
                    setIngredientId(e.target.value);
                    setSelected(null);
                    setKgInput("");
                  }}
                  data-testid="delivery-ingredient"
                >
                  {ingredients.map((id) => (
                    <option key={id} value={id}>
                      {nm(d.ingredientsById.get(id))}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="d-kitchen">{L.kitchen}</Label>
                <Select id="d-kitchen" value={kitchenId} onChange={(e) => (setKitchenId(e.target.value), setKgInput(""))} data-testid="delivery-kitchen">
                  {kitchens.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </Select>
              </div>
              <fieldset className="grid gap-1.5">
                <legend className="mb-1.5 text-sm font-semibold">{L.date}</legend>
                <div className="grid grid-cols-2 gap-2">
                  {dates.map((x, i) => (
                    <button
                      key={x}
                      type="button"
                      aria-pressed={x === date}
                      onClick={() => setDate(x)}
                      className={cn(
                        "min-h-12 rounded-xl border text-base font-semibold focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
                        x === date ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface",
                      )}
                    >
                      {i === 0 ? `${t.common.tomorrow} · ` : ""}
                      {formatDate(x, lang, { weekday: true })}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="grid gap-2">
                <legend className="mb-1.5 text-sm font-semibold">{L.farmers}</legend>
                {pool.length === 0 ? <p className="text-sm text-muted">{L.noFarmers}</p> : null}
                {pool.map((p) => {
                  const f = d.farmersById.get(p.farmerId)!;
                  const on = chosen.includes(p.farmerId);
                  return (
                    <CheckboxRow
                      key={p.farmerId}
                      id={`farmer-${p.farmerId}`}
                      checked={on}
                      onChange={(v) => {
                        setSelected(v ? [...chosen, p.farmerId] : chosen.filter((x) => x !== p.farmerId));
                        setKgInput("");
                      }}
                    >
                      {f.displayName} <span className="font-normal text-muted">· {f.village} · {formatKg(p.kg, lang)}{t.common.perWeek}</span>
                    </CheckboxRow>
                  );
                })}
              </fieldset>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="d-kg">{L.kg}</Label>
                  <Input id="d-kg" type="number" inputMode="decimal" min={0} value={kgInput === "" ? String(suggestedKg) : kgInput} onChange={(e) => setKgInput(e.target.value)} />
                </div>
                <fieldset className="grid gap-1.5">
                  <legend className="mb-1.5 text-sm font-semibold">{L.grade}</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {(["A", "B"] as const).map((g) => (
                      <button
                        key={g}
                        type="button"
                        aria-pressed={grade === g}
                        onClick={() => setGrade(g)}
                        title={g === "A" ? L.gradeA : L.gradeB}
                        className={cn(
                          "min-h-11 rounded-xl border text-base font-bold focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
                          grade === g ? "border-primary bg-primary-soft text-primary-strong" : "border-border bg-surface",
                        )}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>
              <p className="text-sm text-muted">
                {L.harvestDate}: {formatDate(addDays(date, -1), lang, { weekday: true })} · {grade === "A" ? L.gradeA : L.gradeB}
              </p>
              {needsCold ? (
                <CheckboxRow id="d-cold" checked={cold} onChange={setCold} testId="delivery-cold">
                  {L.coldChain}
                </CheckboxRow>
              ) : null}
              {needsCold && !cold ? <p className="text-sm font-semibold text-warn-strong">{L.coldRequired}</p> : null}
              {chosen.length === 0 ? <p className="text-sm font-semibold text-warn-strong">{L.selectAtLeastOne}</p> : null}
              <Button
                size="lg"
                onClick={generate}
                disabled={!ing || chosen.length === 0 || (needsCold && !cold) || kg <= 0}
                data-testid="generate-qr"
                data-tour="generate-qr"
              >
                <QrCode aria-hidden /> {L.generate}
              </Button>
            </CardContent>
          </Card>
        )}

        <section className="grid grid-cols-1 gap-2" aria-labelledby="recent-batches">
          <h2 id="recent-batches" className="text-lg font-bold">
            {L.recent}
          </h2>
          <ul className="grid grid-cols-1 gap-2">
            {recent.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/trace/${b.id}`}
                  className="flex min-h-13 items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 hover:bg-muted-surface focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
                >
                  <span className="font-mono font-bold">{b.id}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    <IngredientLabel ingredient={d.ingredientsById.get(b.ingredientId)} /> · {formatKg(b.kg, lang)} · {d.kitchensById.get(b.kitchenId)?.name}
                  </span>
                  {b.deliveredAt ? <Badge variant="green">{L.received}</Badge> : <Badge variant="yellow">{L.inTransit}</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </KopdesShell>
  );
}
