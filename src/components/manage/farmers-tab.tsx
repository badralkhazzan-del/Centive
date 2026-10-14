"use client";

import { useState } from "react";
import { Check, Phone, Plus, Trash2 } from "lucide-react";
import type { Farmer } from "@/types";
import { IngredientLabel } from "@/components/common/ingredient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckboxRow } from "@/components/ui/checkbox";
import { formatNumber, formatPct } from "@/engines/format";
import { useT } from "@/i18n";
import { useAppData } from "@/lib/repo";
import type { FarmerInput } from "@/lib/repo/manage";
import { AddButton, EmptyList, Field, FormCard, NumberField, RecordRow, Section, SelectField, usePermissions, useSave } from "./parts";
import { useFarmersStrings } from "./farmers-strings";

type Editing = { mode: "new" } | { mode: "edit"; id: string } | null;

export function FarmersTab() {
  const { t } = useT();
  const s = useFarmersStrings();
  const data = useAppData();
  const perms = usePermissions();
  const save = useSave();
  const ownKopdes = perms.role === "kopdes" ? (perms.user?.entityId ?? "") : null;
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Editing>(null);

  const kopdesList = ownKopdes !== null ? data.kopdes.filter((k) => k.id === ownKopdes) : data.kopdes;
  const selected = ownKopdes ?? (kopdesList.some((k) => k.id === filter) ? filter : "all");
  const kopdesName = new Map(data.kopdes.map((k) => [k.id, k.name]));
  const inScope = data.farmers
    .filter((f) => (selected === "all" ? kopdesList.some((k) => k.id === f.kopdesId) : f.kopdesId === selected))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  const q = query.trim().toLowerCase();
  const shown = q ? inScope.filter((f) => f.displayName.toLowerCase().includes(q) || f.village.toLowerCase().includes(q)) : inScope;
  const canAdd = kopdesList.length > 0 && (selected === "all" ? perms.isAdmin : perms.canEditFarmersOf(selected));
  const defaultKopdes = selected !== "all" ? selected : (kopdesList[0]?.id ?? "");

  const onSave = (input: FarmerInput) => {
    save("saveFarmer", [input]);
    setEditing(null);
  };

  return (
    <Section
      title={t.manage.farmers.title}
      action={canAdd && editing?.mode !== "new" ? <AddButton onClick={() => setEditing({ mode: "new" })} testId="farmers-add" /> : null}
    >
      {kopdesList.length === 0 ? <p className="text-muted">{s.noKopdes}</p> : null}
      {editing?.mode === "new" ? (
        <FarmerForm key="new" kopdesId={defaultKopdes} lockKopdes={ownKopdes !== null} onSave={onSave} onCancel={() => setEditing(null)} />
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {ownKopdes === null && kopdesList.length > 1 ? (
          <SelectField id="farmers-filter" label={t.manage.farmers.kopdes} value={selected} onChange={(e) => setFilter(e.target.value)} data-testid="farmers-filter">
            <option value="all">{s.allKopdes}</option>
            {kopdesList.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </SelectField>
        ) : null}
        <Field
          id="farmers-search"
          type="search"
          label={s.search}
          placeholder={s.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          data-testid="farmers-search"
        />
      </div>
      <p className="text-sm text-muted" aria-live="polite">
        {s.count(shown.length, inScope.length)}
      </p>
      {inScope.length === 0 ? (
        <EmptyList />
      ) : shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border-strong bg-surface p-6 text-center text-muted">{s.noMatch}</p>
      ) : (
        <ul className="grid gap-3">
          {shown.map((f) =>
            editing?.mode === "edit" && editing.id === f.id ? (
              <li key={f.id}>
                <FarmerForm farmer={f} kopdesId={f.kopdesId} lockKopdes={ownKopdes !== null} onSave={onSave} onCancel={() => setEditing(null)} />
              </li>
            ) : (
              <FarmerRow
                key={f.id}
                farmer={f}
                kopdesName={kopdesName.get(f.kopdesId) ?? ""}
                onEdit={perms.canEditFarmersOf(f.kopdesId) ? () => setEditing({ mode: "edit", id: f.id }) : undefined}
                onRemove={perms.canEditFarmersOf(f.kopdesId) ? () => save("deleteFarmer", [f.id]) : undefined}
              />
            ),
          )}
        </ul>
      )}
    </Section>
  );
}

function FarmerRow({ farmer, kopdesName, onEdit, onRemove }: { farmer: Farmer; kopdesName: string; onEdit?: () => void; onRemove?: () => void }) {
  const { t, lang } = useT();
  const data = useAppData();
  return (
    <RecordRow
      title={farmer.displayName}
      meta={[farmer.village, kopdesName].filter(Boolean).join(" · ")}
      onEdit={onEdit}
      onRemove={onRemove}
      removeName={farmer.displayName}
      testId={`farmer-row-${farmer.id}`}
    >
      {farmer.commodities.length > 0 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {farmer.commodities.map((c) => (
            <li key={c.ingredientId} className="inline-flex items-center gap-1.5">
              <IngredientLabel ingredient={data.ingredients.find((i) => i.id === c.ingredientId)} />
              <span className="tabular-nums text-muted">
                {formatNumber(c.weeklyCapacityKg, lang)} {t.common.kg}
                {t.common.perWeek}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span>
          {t.kopdes.farmers.reliability} <span className="font-semibold tabular-nums">{formatPct(farmer.reliabilityScore, lang)}</span>
        </span>
        {farmer.consentGiven ? (
          <Badge variant="green">
            <Check aria-hidden /> {t.kopdes.farmers.consentGiven}
          </Badge>
        ) : (
          <Badge variant="yellow" className="whitespace-normal">
            {t.manage.farmers.noConsent}
          </Badge>
        )}
        {farmer.phoneMasked ? (
          <span className="inline-flex items-center gap-1 text-muted tabular-nums">
            <Phone className="size-4" aria-hidden />
            <span className="sr-only">{t.manage.farmers.phone}: </span>
            {farmer.phoneMasked}
          </span>
        ) : null}
      </div>
    </RecordRow>
  );
}

interface ProductDraft {
  key: number;
  ingredientId: string;
  kg: number;
}

function FarmerForm({
  farmer,
  kopdesId: initialKopdes,
  lockKopdes,
  onSave,
  onCancel,
}: {
  farmer?: Farmer;
  kopdesId: string;
  lockKopdes: boolean;
  onSave: (input: FarmerInput) => void;
  onCancel: () => void;
}) {
  const { t, nm } = useT();
  const L = t.manage.farmers;
  const s = useFarmersStrings();
  const data = useAppData();
  const idp = `farmer-${farmer?.id ?? "new"}`;
  const [name, setName] = useState(farmer?.displayName ?? "");
  const [village, setVillage] = useState(farmer?.village ?? "");
  const [kopdesId, setKopdesId] = useState(initialKopdes);
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<Farmer["gender"]>(farmer?.gender ?? "female");
  const [ageGroup, setAgeGroup] = useState<Farmer["ageGroup"]>(farmer?.ageGroup ?? "adult");
  const [products, setProducts] = useState<ProductDraft[]>(() =>
    (farmer?.commodities ?? []).map((c, i) => ({ key: i, ingredientId: c.ingredientId, kg: c.weeklyCapacityKg })),
  );
  const [reliability, setReliability] = useState(Math.round((farmer?.reliabilityScore ?? 0.8) * 100));
  const [consent, setConsent] = useState(farmer?.consentGiven ?? false);

  const digits = phone.replace(/\D/g, "").length;
  const phoneOk = phone.trim() === "" || (digits >= 8 && digits <= 15);
  const ids = products.map((p) => p.ingredientId).filter(Boolean);
  const duplicate = new Set(ids).size !== ids.length;
  const productsOk = !duplicate && products.every((p) => p.ingredientId && p.kg >= 1 && p.kg <= 100000);
  const canSave =
    name.trim() !== "" && data.kopdes.some((k) => k.id === kopdesId) && phoneOk && productsOk && reliability >= 0 && reliability <= 100;

  const update = (key: number, patch: Partial<ProductDraft>) => setProducts((ps) => ps.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  const addProduct = () => setProducts((ps) => [...ps, { key: Math.max(-1, ...ps.map((p) => p.key)) + 1, ingredientId: "", kg: 50 }]);
  const ingredients = [...data.ingredients].sort((a, b) => nm(a).localeCompare(nm(b)));

  const submit = () =>
    onSave({
      ...(farmer ? { id: farmer.id } : {}),
      displayName: name.trim(),
      village: village.trim(),
      kopdesId,
      gender,
      ageGroup,
      commodities: products.map((p) => ({ ingredientId: p.ingredientId, weeklyCapacityKg: p.kg })),
      reliabilityScore: reliability / 100,
      consentGiven: consent,
      ...(phone.trim() ? { phone: phone.trim() } : {}),
    });

  return (
    <FormCard title={farmer ? s.editFarmer(farmer.displayName) : s.newFarmer} onSave={submit} onCancel={onCancel} canSave={canSave} testId="farmer-form">
      <div className="grid gap-4 sm:grid-cols-2 [&>*]:content-start">
        <Field id={`${idp}-name`} label={L.firstName} hint={L.firstNameHint} value={name} onChange={(e) => setName(e.target.value)} required autoComplete="off" />
        <Field id={`${idp}-village`} label={t.manage.village} value={village} onChange={(e) => setVillage(e.target.value)} autoComplete="off" />
        <SelectField id={`${idp}-kopdes`} label={L.kopdes} value={kopdesId} onChange={(e) => setKopdesId(e.target.value)} disabled={lockKopdes}>
          {data.kopdes
            .filter((k) => !lockKopdes || k.id === initialKopdes)
            .map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
        </SelectField>
        <div className="grid gap-1.5">
          <Field
            id={`${idp}-phone`}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            label={L.phone}
            hint={farmer?.phoneMasked ? `${L.phoneHint} ${s.phoneKeep(farmer.phoneMasked)}` : L.phoneHint}
            placeholder={farmer?.phoneMasked || s.phonePlaceholder}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-invalid={!phoneOk || undefined}
          />
          {!phoneOk ? <p className="text-sm font-semibold text-danger-strong">{s.phoneInvalid}</p> : null}
        </div>
        <SelectField id={`${idp}-gender`} label={L.gender} value={gender} onChange={(e) => setGender(e.target.value as Farmer["gender"])}>
          <option value="female">{L.female}</option>
          <option value="male">{L.male}</option>
        </SelectField>
        <SelectField id={`${idp}-age`} label={L.age} value={ageGroup} onChange={(e) => setAgeGroup(e.target.value as Farmer["ageGroup"])}>
          <option value="youth">{L.youth}</option>
          <option value="adult">{L.adult}</option>
        </SelectField>
      </div>

      <fieldset className="grid gap-3">
        <legend className="mb-2 text-base font-bold">{L.commodities}</legend>
        {products.map((p, i) => (
          <div key={p.key} className="flex flex-wrap items-end gap-2 rounded-xl border border-border p-3">
            <SelectField
              id={`${idp}-product-${p.key}`}
              label={`${s.product} ${i + 1}`}
              className="min-w-48 flex-1"
              value={p.ingredientId}
              onChange={(e) => update(p.key, { ingredientId: e.target.value })}
            >
              <option value="">{t.manage.team.choose}</option>
              {ingredients.map((ing) => (
                <option key={ing.id} value={ing.id}>
                  {ing.emoji} {nm(ing)}
                </option>
              ))}
            </SelectField>
            <NumberField
              id={`${idp}-kg-${p.key}`}
              label={L.capacity}
              className="w-32"
              value={p.kg}
              onValue={(kg) => update(p.key, { kg })}
              min={1}
              max={100000}
              step={1}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-danger-strong hover:bg-danger-soft"
              aria-label={s.removeProduct(nm(data.ingredients.find((x) => x.id === p.ingredientId)))}
              onClick={() => setProducts((ps) => ps.filter((x) => x.key !== p.key))}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        ))}
        {duplicate ? <p className="text-sm font-semibold text-danger-strong">{s.duplicateProduct}</p> : null}
        <div>
          <Button type="button" variant="outline" onClick={addProduct} data-testid="farmer-add-product">
            <Plus aria-hidden /> {L.addCommodity}
          </Button>
        </div>
      </fieldset>

      <NumberField
        id={`${idp}-reliability`}
        label={L.reliability}
        hint={L.reliabilityHint}
        className="sm:max-w-xs"
        value={reliability}
        onValue={setReliability}
        min={0}
        max={100}
        step={1}
      />
      <CheckboxRow id={`${idp}-consent`} checked={consent} onChange={setConsent} testId="farmer-consent">
        {L.consent}
      </CheckboxRow>
      <p className="text-sm text-muted">{L.inviteHint}</p>
    </FormCard>
  );
}
