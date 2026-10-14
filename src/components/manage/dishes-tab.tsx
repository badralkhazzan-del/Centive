"use client";

import { useState } from "react";
import { Lock, Plus, Trash2, X } from "lucide-react";
import type { Dish, DishComponent, Ingredient, MenuCycle, Sized } from "@/types";
import { Button } from "@/components/ui/button";
import { Select, Label } from "@/components/ui/input";
import { IngredientLabel } from "@/components/common/ingredient";
import { formatNumber, formatRp, weekdayName } from "@/engines/format";
import { portionCost, portionNutrition } from "@/engines/nutrition";
import { addDays } from "@/engines/time";
import { useT } from "@/i18n";
import type { DishInput } from "@/lib/repo/manage";
import { useAppData, useDerived } from "@/lib/repo";
import { AddButton, EmptyList, Field, FormCard, NumberField, RecordRow, Section, SelectField, usePermissions, useSave } from "./parts";
import { useDishesStrings } from "./dishes-strings";

const SIZES = ["small", "large"] as const;
const MONDAY = "2024-01-01";

export function DishesTab() {
  return (
    <div className="grid gap-10">
      <DishLibrary />
      <MenuByKitchen />
    </div>
  );
}

// ----- Dishes library -----------------------------------------------------------------

function useIngredientOptions() {
  const data = useAppData();
  const { nm } = useT();
  return [...data.ingredients].sort((a, b) => nm(a).localeCompare(nm(b)));
}

function DishLibrary() {
  const { t } = useT();
  const s = useDishesStrings();
  const data = useAppData();
  const { canEditLibrary } = usePermissions();
  const [editing, setEditing] = useState<string | null>(null);
  const adding = editing === "";

  return (
    <Section
      title={t.manage.dishes.title}
      hint={s.count(data.dishes.length)}
      action={canEditLibrary && !adding ? <AddButton onClick={() => setEditing("")} label={s.addDish} testId="add-dish" /> : undefined}
    >
      {adding ? <DishForm onDone={() => setEditing(null)} /> : null}
      {data.dishes.length === 0 ? (
        <EmptyList />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {data.dishes.map((dish) =>
            editing === dish.id ? (
              <li key={dish.id} className="lg:col-span-2">
                <DishForm dish={dish} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <DishRow key={dish.id} dish={dish} onEdit={canEditLibrary ? () => setEditing(dish.id) : undefined} />
            ),
          )}
        </ul>
      )}
    </Section>
  );
}

function DishRow({ dish, onEdit }: { dish: Dish; onEdit?: () => void }) {
  const { t, nm } = useT();
  const d = useDerived();
  return (
    <RecordRow
      title={nm(dish)}
      meta={
        <>
          {t.manage.dishes.main}: <IngredientLabel ingredient={d.ingredientsById.get(dish.mainIngredientId)} />
        </>
      }
      onEdit={onEdit}
      testId={`dish-${dish.id}`}
    >
      <ul className="flex flex-wrap gap-1.5 text-sm">
        {dish.components.map((c) => (
          <li key={c.ingredientId} className="rounded-lg bg-muted-surface px-2 py-1">
            <IngredientLabel ingredient={d.ingredientsById.get(c.ingredientId)} />{" "}
            <span className="tabular-nums text-muted">
              {c.gramsPerPortion.small} / {c.gramsPerPortion.large} g
            </span>
          </li>
        ))}
      </ul>
      <DishStats components={dish.components} />
    </RecordRow>
  );
}

/** Energy, protein and raw-food cost per small and large portion. */
function DishStats({ components }: { components: DishComponent[] }) {
  const { t, lang } = useT();
  const d = useDerived();
  const comps = components.map((c) => ({
    ingredientId: c.ingredientId,
    grams: c.gramsPerPortion,
    dishId: "",
  }));
  const price = (id: string) => d.price(id, 1);
  return (
    <dl className="grid gap-1 text-sm sm:grid-cols-2" aria-label={t.kitchen.menu.perPortion}>
      {SIZES.map((size) => {
        const n = portionNutrition(comps, size, d.ingredientsById);
        const cost = portionCost(comps, size, d.ingredientsById, price);
        return (
          <div key={size} className="flex flex-wrap gap-x-2">
            <dt className="font-semibold">{size === "small" ? t.common.small : t.common.large}:</dt>
            <dd className="tabular-nums text-muted">
              {formatNumber(n.energyKcal, lang)} kcal · {t.kitchen.menu.protein} {formatNumber(n.proteinG, lang, 1)} g · {formatRp(cost, lang)}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

interface Row {
  key: number;
  ingredientId: string;
  grams: Sized<number>;
}

function DishForm({ dish, onDone }: { dish?: Dish; onDone: () => void }) {
  const { t, nm } = useT();
  const s = useDishesStrings();
  const save = useSave();
  const ingredients = useIngredientOptions();
  const [nameEn, setNameEn] = useState(dish?.nameEn ?? "");
  const [nameId, setNameId] = useState(dish?.nameId ?? "");
  const [main, setMain] = useState(dish?.mainIngredientId ?? "");
  const [rows, setRows] = useState<Row[]>(() =>
    (dish?.components ?? []).map((c, i) => ({
      key: i,
      ingredientId: c.ingredientId,
      grams: c.gramsPerPortion,
    })),
  );
  const [nextKey, setNextKey] = useState(rows.length);

  const addRow = (ingredientId = "") => {
    setRows((r) => [...r, { key: nextKey, ingredientId, grams: { small: 0, large: 0 } }]);
    setNextKey((k) => k + 1);
  };
  const updateRow = (key: number, patch: Partial<Row>) => setRows((r) => r.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const chosen = rows.map((r) => r.ingredientId).filter(Boolean);
  const duplicate = new Set(chosen).size !== chosen.length;
  const mainMissing = main !== "" && !chosen.includes(main);
  const gramsBad = rows.some((r) => SIZES.some((sz) => !(r.grams[sz] >= 0 && r.grams[sz] <= 1000)));
  const canSave =
    nameEn.trim() !== "" && nameId.trim() !== "" && main !== "" && rows.length > 0 && rows.every((r) => r.ingredientId) && !duplicate && !mainMissing && !gramsBad;

  const prefix = dish ? `dish-${dish.id}` : "dish-new";
  const components: DishComponent[] = rows.filter((r) => r.ingredientId).map((r) => ({ ingredientId: r.ingredientId, gramsPerPortion: r.grams }));

  return (
    <FormCard
      title={dish ? s.editDish(nm(dish)) : s.newDish}
      canSave={canSave}
      onCancel={onDone}
      testId="dish-form"
      onSave={() => {
        const input: DishInput = {
          id: dish?.id,
          nameEn: nameEn.trim(),
          nameId: nameId.trim(),
          mainIngredientId: main,
          components,
        };
        save("saveDish", [input]);
        onDone();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${prefix}-en`} label={t.manage.ingredients.nameEn} value={nameEn} onChange={(e) => setNameEn(e.target.value)} required maxLength={120} />
        <Field id={`${prefix}-id`} label={t.manage.ingredients.nameId} value={nameId} onChange={(e) => setNameId(e.target.value)} required maxLength={120} />
        <SelectField
          id={`${prefix}-main`}
          label={t.manage.dishes.main}
          value={main}
          required
          onChange={(e) => {
            const id = e.target.value;
            setMain(id);
            if (id && !chosen.includes(id)) addRow(id);
          }}
        >
          <option value="">{t.manage.team.choose}</option>
          <IngredientOptions ingredients={ingredients} />
        </SelectField>
      </div>

      <fieldset className="grid gap-3">
        <legend className="mb-2 font-bold">{t.manage.dishes.components}</legend>
        {rows.length === 0 ? <p className="text-sm text-muted">{s.needComponent}</p> : null}
        <ul className="grid gap-3">
          {rows.map((row, i) => {
            const ing = ingredients.find((x) => x.id === row.ingredientId);
            return (
              <li
                key={row.key}
                className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
                data-testid="dish-component"
              >
                <SelectField
                  id={`${prefix}-c${row.key}-ing`}
                  label={`${s.ingredient} ${i + 1}`}
                  value={row.ingredientId}
                  onChange={(e) => updateRow(row.key, { ingredientId: e.target.value })}
                >
                  <option value="">{t.manage.team.choose}</option>
                  <IngredientOptions ingredients={ingredients} />
                </SelectField>
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-3 sm:contents">
                  <NumberField
                    id={`${prefix}-c${row.key}-s`}
                    label={t.manage.dishes.small}
                    min={0}
                    max={1000}
                    value={row.grams.small}
                    onValue={(v) => updateRow(row.key, { grams: { ...row.grams, small: v } })}
                  />
                  <NumberField
                    id={`${prefix}-c${row.key}-l`}
                    label={t.manage.dishes.large}
                    min={0}
                    max={1000}
                    value={row.grams.large}
                    onValue={(v) => updateRow(row.key, { grams: { ...row.grams, large: v } })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-danger-strong hover:bg-danger-soft"
                    aria-label={`${t.manage.remove}: ${ing ? nm(ing) : `${s.ingredient} ${i + 1}`}`}
                    onClick={() => setRows((r) => r.filter((x) => x.key !== row.key))}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
        <div>
          <Button type="button" variant="outline" onClick={() => addRow()} data-testid="add-component">
            <Plus aria-hidden /> {t.manage.dishes.addComponent}
          </Button>
        </div>
        <div aria-live="polite" className="grid gap-1 text-sm font-semibold text-danger-strong">
          {mainMissing ? <p>{s.mainMissing}</p> : null}
          {duplicate ? <p>{s.duplicate}</p> : null}
          {gramsBad ? <p>{s.gramsRange}</p> : null}
        </div>
        {components.length > 0 ? <DishStats components={components} /> : null}
      </fieldset>
    </FormCard>
  );
}

function IngredientOptions({ ingredients }: { ingredients: Ingredient[] }) {
  const { nm } = useT();
  return ingredients.map((ing) => (
    <option key={ing.id} value={ing.id}>
      {nm(ing)}
    </option>
  ));
}

// ----- Menu by kitchen ----------------------------------------------------------------

function MenuByKitchen() {
  const { t } = useT();
  const s = useDishesStrings();
  const data = useAppData();
  const perms = usePermissions();
  const ownOnly = perms.role === "kitchen";
  const kitchens = ownOnly ? data.kitchens.filter((k) => k.id === perms.user?.entityId) : data.kitchens;
  const [picked, setPicked] = useState(data.ui.activeKitchenId);
  const kitchen = kitchens.find((k) => k.id === picked) ?? kitchens[0];
  const cycle = kitchen ? data.menuCycles.find((c) => c.kitchenId === kitchen.id) : undefined;
  const editable = kitchen ? perms.canEditKitchen(kitchen.id) : false;

  return (
    <Section title={t.manage.dishes.menuTitle} hint={t.manage.dishes.menuHint}>
      {!kitchen ? (
        <p className="rounded-2xl border border-dashed border-border-strong bg-surface p-6 text-center text-muted">{s.noKitchen}</p>
      ) : (
        <>
          <SelectField
            id="menu-kitchen"
            label={t.manage.dishes.kitchen}
            className="max-w-md"
            value={kitchen.id}
            disabled={ownOnly}
            onChange={(e) => setPicked(e.target.value)}
          >
            {kitchens.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </SelectField>
          {!editable ? <p className="text-sm text-muted">{s.readOnly}</p> : null}
          {cycle ? <CycleWeeks kitchenId={kitchen.id} cycle={cycle} editable={editable} /> : <EmptyList />}
          {!cycle ? <p className="text-sm text-muted">{s.noCycle}</p> : null}
        </>
      )}
    </Section>
  );
}

function CycleWeeks({ kitchenId, cycle, editable }: { kitchenId: string; cycle: MenuCycle; editable: boolean }) {
  const { t, lang } = useT();
  return (
    <div className="grid gap-6" data-testid="menu-cycle">
      {[1, 2, 3, 4].map((week) => (
        <div key={week} className="grid gap-3">
          <h3 className="text-lg font-bold">{t.common.weekN(week)}</h3>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[0, 1, 2, 3, 4].map((dow) => {
              const dayIndex = (week - 1) * 5 + dow + 1;
              return (
                <MenuDayCard
                  key={dayIndex}
                  kitchenId={kitchenId}
                  dayIndex={dayIndex}
                  title={t.manage.dishes.day(week, weekdayName(addDays(MONDAY, dow), lang, true))}
                  dishIds={cycle.days.find((d) => d.dayIndex === dayIndex)?.dishIds ?? []}
                  lockedIds={cycle.lockedDishIds}
                  editable={editable}
                />
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function MenuDayCard({
  kitchenId,
  dayIndex,
  title,
  dishIds,
  lockedIds,
  editable,
}: {
  kitchenId: string;
  dayIndex: number;
  title: string;
  dishIds: string[];
  lockedIds: string[];
  editable: boolean;
}) {
  const { t, nm } = useT();
  const s = useDishesStrings();
  const d = useDerived();
  const save = useSave();
  const data = useAppData();
  const setDay = (ids: string[]) => save("setMenuDay", [kitchenId, dayIndex, ids]);
  const options = data.dishes.filter((x) => !dishIds.includes(x.id)).sort((a, b) => nm(a).localeCompare(nm(b)));
  const selectId = `menu-${kitchenId}-${dayIndex}-add`;

  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-surface p-3 shadow-soft" data-testid={`menu-day-${dayIndex}`}>
      <h4 className="font-bold">{title}</h4>
      {dishIds.length === 0 ? <p className="text-sm text-muted">{s.emptyDay}</p> : null}
      <ul className="grid gap-1">
        {dishIds.map((id) => {
          const dish = d.dishesById.get(id);
          const name = dish ? nm(dish) : id;
          const locked = lockedIds.includes(id);
          return (
            <li key={id} className="flex min-h-11 items-center gap-1.5 text-sm">
              {locked ? (
                <span title={s.locked} className="shrink-0">
                  <Lock aria-hidden className="size-4 text-muted" />
                </span>
              ) : null}
              <span className="min-w-0 flex-1 break-words">
                {name}
                {locked ? <span className="sr-only"> ({s.locked})</span> : null}
              </span>
              {editable ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted hover:text-danger-strong"
                  aria-label={`${t.manage.remove}: ${name}, ${title}`}
                  onClick={() => setDay(dishIds.filter((x) => x !== id))}
                  data-testid={`remove-${dayIndex}-${id}`}
                >
                  <X aria-hidden />
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {editable ? (
        <div className="mt-auto grid gap-1.5">
          <Label htmlFor={selectId} className="text-xs">
            {t.manage.dishes.addDish}
          </Label>
          <Select
            id={selectId}
            value=""
            className="text-sm"
            onChange={(e) => {
              if (e.target.value) setDay([...dishIds, e.target.value]);
            }}
          >
            <option value="">{t.manage.team.choose}</option>
            {options.map((x) => (
              <option key={x.id} value={x.id}>
                {nm(x)}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
    </li>
  );
}
