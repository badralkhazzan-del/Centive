"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckboxRow } from "@/components/ui/checkbox";
import { formatNumber } from "@/engines/format";
import { useT } from "@/i18n";
import { useAppData } from "@/lib/repo";
import type { IngredientInput } from "@/lib/repo/manage";
import type { FoodGroup, Ingredient } from "@/types";
import { useFoodStrings } from "./food-strings";
import { AddButton, EmptyList, Field, FormCard, NumberField, RecordRow, Section, SelectField, usePermissions, useSave } from "./parts";

const GROUPS: FoodGroup[] = ["staple", "animal_protein", "plant_protein", "vegetable", "fruit", "dairy", "fat"];

interface Draft {
  nameEn: string;
  nameId: string;
  tkpiName: string;
  foodGroup: FoodGroup;
  unit: "kg" | "L";
  emoji: string;
  kcal: number;
  protein: number;
  ediblePct: number;
  verified: boolean;
  dataSource: string;
}

function toDraft(ing?: Ingredient): Draft {
  return {
    nameEn: ing?.nameEn ?? "",
    nameId: ing?.nameId ?? "",
    tkpiName: ing?.tkpiName ?? "",
    foodGroup: ing?.foodGroup ?? "vegetable",
    unit: ing?.unit ?? "kg",
    emoji: ing?.emoji ?? "",
    kcal: ing?.energyKcalPer100g ?? 0,
    protein: ing?.proteinGPer100g ?? 0,
    ediblePct: Math.round((ing?.edibleFraction ?? 1) * 100),
    verified: ing?.verified ?? false,
    dataSource: ing?.dataSource ?? "",
  };
}

const inRange = (v: number, min: number, max: number) => Number.isFinite(v) && v >= min && v <= max;

function VerifiedBadge({ verified }: { verified: boolean }) {
  const s = useFoodStrings();
  return verified ? (
    <Badge variant="green">
      <CheckCircle2 aria-hidden /> {s.verified}
    </Badge>
  ) : (
    <Badge variant="yellow">
      <CircleAlert aria-hidden /> {s.toVerify}
    </Badge>
  );
}

function IngredientForm({ ingredient, onDone }: { ingredient?: Ingredient; onDone: () => void }) {
  const { t, nm } = useT();
  const s = useFoodStrings();
  const save = useSave();
  const L = t.manage.ingredients;
  const [d, setD] = useState(() => toDraft(ingredient));
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((prev) => ({ ...prev, [key]: value }));
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }), []);

  const valid =
    d.nameEn.trim() !== "" && d.nameId.trim() !== "" && inRange(d.kcal, 0, 1000) && inRange(d.protein, 0, 100) && inRange(d.ediblePct, 5, 100);

  const onSave = () => {
    const input: IngredientInput = {
      id: ingredient?.id,
      nameEn: d.nameEn.trim(),
      nameId: d.nameId.trim(),
      tkpiName: d.tkpiName.trim(),
      foodGroup: d.foodGroup,
      unit: d.unit,
      energyKcalPer100g: d.kcal,
      proteinGPer100g: d.protein,
      edibleFraction: d.ediblePct / 100,
      verified: d.verified,
      dataSource: d.dataSource.trim() || ingredient?.dataSource || "Entered by the team",
      emoji: d.emoji.trim() || ingredient?.emoji || "🥬",
    };
    save("saveIngredient", [input]);
    onDone();
  };

  return (
    <div ref={ref} className="scroll-mt-24">
      <FormCard
        title={ingredient ? s.editIngredient(nm(ingredient)) : s.newIngredient}
        onSave={onSave}
        onCancel={onDone}
        canSave={valid}
        testId="ingredient-form"
      >
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Field id="ing-name-en" label={L.nameEn} value={d.nameEn} onChange={(e) => set("nameEn", e.target.value)} required data-testid="ing-name-en" />
          <Field id="ing-name-id" label={L.nameId} value={d.nameId} onChange={(e) => set("nameId", e.target.value)} required data-testid="ing-name-id" />
          <Field id="ing-tkpi" label={L.tkpi} value={d.tkpiName} onChange={(e) => set("tkpiName", e.target.value)} />
          <SelectField id="ing-group" label={L.group} value={d.foodGroup} onChange={(e) => set("foodGroup", e.target.value as FoodGroup)}>
            {GROUPS.map((g) => (
              <option key={g} value={g}>
                {L.groups[g]}
              </option>
            ))}
          </SelectField>
          <SelectField id="ing-unit" label={L.unit} value={d.unit} onChange={(e) => set("unit", e.target.value as "kg" | "L")}>
            <option value="kg">kg</option>
            <option value="L">L</option>
          </SelectField>
          <Field id="ing-emoji" label={s.emoji} hint={s.emojiHint} value={d.emoji} maxLength={8} onChange={(e) => set("emoji", e.target.value)} />
        </div>
        <div className="grid items-start gap-4 sm:grid-cols-3">
          <NumberField id="ing-kcal" label={L.kcal} value={d.kcal} onValue={(v) => set("kcal", v)} min={0} max={1000} step={1} />
          <NumberField id="ing-protein" label={L.protein} value={d.protein} onValue={(v) => set("protein", v)} min={0} max={100} step={0.1} />
          <NumberField id="ing-edible" label={L.edible} hint={s.edibleHint} value={d.ediblePct} onValue={(v) => set("ediblePct", v)} min={5} max={100} step={1} />
        </div>
        <CheckboxRow id="ing-verified" checked={d.verified} onChange={(v) => set("verified", v)} testId="ing-verified">
          {L.verified}
        </CheckboxRow>
        <Field id="ing-source" label={L.source} hint={s.sourceHint} value={d.dataSource} onChange={(e) => set("dataSource", e.target.value)} />
      </FormCard>
    </div>
  );
}

export function IngredientsTab() {
  const { t, lang, nm } = useT();
  const s = useFoodStrings();
  const data = useAppData();
  const { canEditIngredients } = usePermissions();
  const L = t.manage.ingredients;
  const [editing, setEditing] = useState<string | null>(null);
  const current = editing && editing !== "new" ? data.ingredients.find((i) => i.id === editing) : undefined;
  const onEdit = canEditIngredients ? (id: string) => setEditing(id) : undefined;

  return (
    <Section
      title={L.title}
      hint={L.hint}
      action={canEditIngredients && editing === null ? <AddButton onClick={() => setEditing("new")} label={s.addIngredient} testId="ingredient-add" /> : null}
    >
      <p className="text-sm text-muted">{canEditIngredients ? s.noDelete : t.manage.adminOnly}</p>
      {editing !== null ? <IngredientForm key={editing} ingredient={current} onDone={() => setEditing(null)} /> : null}
      {data.ingredients.length === 0 ? (
        <EmptyList />
      ) : (
        <>
          <ul className="grid gap-3 md:hidden" data-testid="ingredient-list">
            {data.ingredients.map((ing) => (
              <RecordRow
                key={ing.id}
                testId={`ingredient-row-${ing.id}`}
                title={
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden>{ing.emoji}</span> {nm(ing)}
                  </span>
                }
                meta={`${L.groups[ing.foodGroup]} · ${ing.unit}`}
                onEdit={onEdit ? () => onEdit(ing.id) : undefined}
              >
                <dl className="grid grid-cols-3 gap-2 text-sm">
                  <Stat label={L.kcal} value={formatNumber(ing.energyKcalPer100g, lang)} />
                  <Stat label={L.protein} value={formatNumber(ing.proteinGPer100g, lang, 1)} />
                  <Stat label={L.edible} value={formatNumber(ing.edibleFraction * 100, lang)} />
                </dl>
                <div className="grid gap-1 text-sm">
                  <div>
                    <VerifiedBadge verified={ing.verified} />
                  </div>
                  <p className="text-muted">
                    {L.tkpi}: {ing.tkpiName || "-"}
                  </p>
                  <p className="break-words text-muted">
                    {L.source}: {ing.dataSource}
                  </p>
                </div>
              </RecordRow>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-2xl border border-border bg-surface shadow-soft md:block">
            <table className="w-full min-w-[56rem] text-sm" data-testid="ingredient-table">
              <thead className="border-b border-border bg-muted-surface text-left">
                <tr>
                  <th scope="col" className="px-3 py-2.5">{s.ingredient}</th>
                  <th scope="col" className="px-3 py-2.5">{L.tkpi}</th>
                  <th scope="col" className="px-3 py-2.5">{L.group}</th>
                  <th scope="col" className="px-3 py-2.5 text-right">{L.kcal}</th>
                  <th scope="col" className="px-3 py-2.5 text-right">{L.protein}</th>
                  <th scope="col" className="px-3 py-2.5 text-right">{L.edible}</th>
                  <th scope="col" className="px-3 py-2.5">{s.status}</th>
                  <th scope="col" className="px-3 py-2.5">{L.source}</th>
                  {canEditIngredients ? (
                    <th scope="col" className="px-3 py-2.5">
                      <span className="sr-only">{t.manage.edit}</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {data.ingredients.map((ing) => (
                  <tr key={ing.id} className="border-b border-border last:border-0" data-testid={`ingredient-tr-${ing.id}`}>
                    <th scope="row" className="px-3 py-2 text-left font-semibold">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <span aria-hidden>{ing.emoji}</span> {nm(ing)}
                      </span>
                      <span className="block text-xs font-normal text-muted">{ing.unit}</span>
                    </th>
                    <td className="max-w-48 px-3 py-2 text-muted">{ing.tkpiName || "-"}</td>
                    <td className="px-3 py-2">{L.groups[ing.foodGroup]}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumber(ing.energyKcalPer100g, lang)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumber(ing.proteinGPer100g, lang, 1)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumber(ing.edibleFraction * 100, lang)}</td>
                    <td className="px-3 py-2">
                      <VerifiedBadge verified={ing.verified} />
                    </td>
                    <td className="max-w-56 px-3 py-2 break-words text-muted">{ing.dataSource}</td>
                    {canEditIngredients ? (
                      <td className="px-3 py-2">
                        <Button variant="outline" size="sm" onClick={() => setEditing(ing.id)} aria-label={`${t.manage.edit}: ${nm(ing)}`}>
                          <Pencil aria-hidden /> {t.manage.edit}
                        </Button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted-surface px-2 py-1.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-bold tabular-nums">{value}</dd>
    </div>
  );
}
