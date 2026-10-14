"use client";

import { useState } from "react";
import { CalendarDays, Clock, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckboxRow } from "@/components/ui/checkbox";
import { formatDate, formatNumber, formatPct, weekdayName } from "@/engines/format";
import { useT } from "@/i18n";
import { useAppData } from "@/lib/repo";
import type { KitchenInput } from "@/lib/repo/manage";
import type { Holiday, Kitchen, Lang } from "@/types";
import { AddButton, EmptyList, Field, FormCard, NumberField, RecordRow, Section, usePermissions, useSave } from "./parts";
import { usePlacesStrings } from "./places-strings";

// ----- Shared place fields (also used by the Kopdes tab) ------------------------------

export interface PlaceDraft {
  name: string;
  village: string;
  subdistrict: string;
  lat: string;
  lng: string;
}

export function placeDraft(rec?: { name: string; village: string; subdistrict: string; lat: number; lng: number }): PlaceDraft {
  return { name: rec?.name ?? "", village: rec?.village ?? "", subdistrict: rec?.subdistrict ?? "", lat: rec ? String(rec.lat) : "", lng: rec ? String(rec.lng) : "" };
}

const coordOk = (v: string, limit: number) => v.trim() === "" || (Number.isFinite(Number(v)) && Math.abs(Number(v)) <= limit);
export const coordsValid = (d: PlaceDraft) => coordOk(d.lat, 90) && coordOk(d.lng, 180);
export const placeValid = (d: PlaceDraft) => d.name.trim() !== "" && coordsValid(d);

export function placeInput(d: PlaceDraft) {
  return {
    name: d.name.trim(),
    village: d.village.trim(),
    subdistrict: d.subdistrict.trim(),
    ...(d.lat.trim() ? { lat: Number(d.lat) } : {}),
    ...(d.lng.trim() ? { lng: Number(d.lng) } : {}),
  };
}

export const placeLine = (rec: { village: string; subdistrict: string }) => [rec.village, rec.subdistrict].filter(Boolean).join(", ");

export function PlaceFields({ prefix, value, onChange }: { prefix: string; value: PlaceDraft; onChange: (d: PlaceDraft) => void }) {
  const { t } = useT();
  const s = usePlacesStrings();
  const set = (key: keyof PlaceDraft) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [key]: e.target.value });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field id={`${prefix}-name`} label={t.manage.name} value={value.name} onChange={set("name")} required className="sm:col-span-2" data-testid={`${prefix}-name`} />
      <Field id={`${prefix}-village`} label={t.manage.village} value={value.village} onChange={set("village")} />
      <Field id={`${prefix}-subdistrict`} label={t.manage.subdistrict} value={value.subdistrict} onChange={set("subdistrict")} />
      <Field id={`${prefix}-lat`} label={t.manage.lat} value={value.lat} onChange={set("lat")} placeholder="-7.43" aria-invalid={!coordOk(value.lat, 90)} />
      <Field id={`${prefix}-lng`} label={t.manage.lng} value={value.lng} onChange={set("lng")} placeholder="109.25" aria-invalid={!coordOk(value.lng, 180)} />
      <p className="text-xs text-muted sm:col-span-2">{t.manage.mapHint}</p>
      {coordsValid(value) ? null : (
        <p className="text-sm font-semibold text-danger-strong sm:col-span-2" role="alert">
          {s.invalidCoords}
        </p>
      )}
    </div>
  );
}

// ----- Kitchens ------------------------------------------------------------------------

/** Monday..Saturday as ISO weekday numbers, named via a known Monday (2024-01-01). */
const WEEKDAYS = [1, 2, 3, 4, 5, 6];
const dayName = (iso: number, lang: Lang, long = false) => weekdayName(`2024-01-0${iso}`, lang, long);

export function KitchensTab() {
  const { t } = useT();
  const s = usePlacesStrings();
  const data = useAppData();
  const perms = usePermissions();
  const save = useSave();
  const [editing, setEditing] = useState<string | null>(null);
  const [calendarFor, setCalendarFor] = useState<string | null>(null);

  return (
    <Section
      title={t.manage.kitchens.title}
      action={perms.isAdmin && editing !== "new" ? <AddButton label={s.addKitchen} onClick={() => setEditing("new")} testId="kitchen-add" /> : null}
    >
      {editing === "new" ? <KitchenForm onDone={() => setEditing(null)} /> : null}
      {data.kitchens.length === 0 ? (
        editing === "new" ? null : <EmptyList />
      ) : (
        <ul className="grid gap-3">
          {data.kitchens.map((k) =>
            editing === k.id ? (
              <li key={k.id}>
                <KitchenForm kitchen={k} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <KitchenRow
                key={k.id}
                kitchen={k}
                onEdit={perms.canEditKitchen(k.id) ? () => setEditing(k.id) : undefined}
                onRemove={perms.isAdmin ? () => save("deleteKitchen", [k.id]) : undefined}
                calendarOpen={calendarFor === k.id}
                onCalendar={perms.canEditKitchen(k.id) ? (open) => setCalendarFor(open ? k.id : null) : undefined}
              />
            ),
          )}
        </ul>
      )}
    </Section>
  );
}

function KitchenRow({
  kitchen: k,
  onEdit,
  onRemove,
  calendarOpen,
  onCalendar,
}: {
  kitchen: Kitchen;
  onEdit?: () => void;
  onRemove?: () => void;
  calendarOpen: boolean;
  onCalendar?: (open: boolean) => void;
}) {
  const { t, lang } = useT();
  const s = usePlacesStrings();
  const data = useAppData();
  const linked = k.linkedKopdesIds.map((id) => data.kopdes.find((kd) => kd.id === id)).filter((kd) => kd !== undefined);
  const cal = k.schoolCalendar;
  return (
    <RecordRow title={k.name} meta={placeLine(k)} onEdit={onEdit} onRemove={onRemove} removeName={k.name} testId={`kitchen-row-${k.id}`}>
      <div className="flex flex-wrap gap-2">
        <Badge variant="muted">
          <Users aria-hidden /> {s.children(formatNumber(k.beneficiaries.small + k.beneficiaries.large, lang))}
        </Badge>
        <Badge variant="muted">
          <Clock aria-hidden /> {s.paysWithin(k.paymentSlaDays)}
        </Badge>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <span className="text-muted">{t.manage.kitchens.kopdes}:</span>
        {linked.length === 0 ? <span className="text-muted">{s.noLinks}</span> : null}
        {linked.map((kd) => (
          <Badge key={kd.id} variant="green" className="whitespace-normal">
            {kd.name} {formatPct(k.kopdesOrderShare[kd.id] ?? 0, lang)}
          </Badge>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-muted">
          {t.manage.kitchens.weekdays}: {cal.operatingWeekdays.map((d) => dayName(d, lang)).join(", ")}. {s.closedDays(cal.holidays.length)}
        </span>
        {onCalendar && !calendarOpen ? (
          <Button variant="outline" size="sm" onClick={() => onCalendar(true)} data-testid={`kitchen-calendar-${k.id}`}>
            <CalendarDays aria-hidden /> {t.manage.kitchens.calendar}
          </Button>
        ) : null}
      </div>
      {onCalendar && calendarOpen ? <CalendarForm kitchen={k} onDone={() => onCalendar(false)} /> : null}
    </RecordRow>
  );
}

const isInt = (v: number, lo: number, hi: number) => Number.isInteger(v) && v >= lo && v <= hi;
const inRange = (v: number, lo: number, hi: number) => Number.isFinite(v) && v >= lo && v <= hi;

function KitchenForm({ kitchen, onDone }: { kitchen?: Kitchen; onDone: () => void }) {
  const { t, lang } = useT();
  const s = usePlacesStrings();
  const data = useAppData();
  const perms = usePermissions();
  const save = useSave();
  const [place, setPlace] = useState(() => placeDraft(kitchen));
  const [small, setSmall] = useState(kitchen?.beneficiaries.small ?? 0);
  const [large, setLarge] = useState(kitchen?.beneficiaries.large ?? 0);
  const [attendance, setAttendance] = useState(Math.round((kitchen?.attendanceRate ?? data.settings.attendanceRate) * 100));
  const [sla, setSla] = useState(kitchen?.paymentSlaDays ?? data.settings.paymentSlaDays);
  const [linked, setLinked] = useState<string[]>(kitchen?.linkedKopdesIds ?? []);
  const [shares, setShares] = useState<Record<string, number>>(() =>
    Object.fromEntries(Object.entries(kitchen?.kopdesOrderShare ?? {}).map(([id, v]) => [id, Math.round(v * 100)])),
  );
  const prefix = kitchen ? `kitchen-${kitchen.id}` : "kitchen-new";

  const toggle = (id: string, on: boolean) => {
    if (on && shares[id] === undefined) {
      const used = linked.reduce((sum, x) => sum + (shares[x] ?? 0), 0);
      setShares({ ...shares, [id]: Math.max(0, 100 - used) });
    }
    setLinked(on ? [...linked, id] : linked.filter((x) => x !== id));
  };
  const total = linked.reduce((sum, id) => sum + (shares[id] ?? 0), 0);
  const valid =
    placeValid(place) &&
    isInt(small, 0, 20000) &&
    isInt(large, 0, 20000) &&
    inRange(attendance, 50, 100) &&
    isInt(sla, 1, 60) &&
    linked.every((id) => inRange(shares[id] ?? 0, 0, 100));

  const onSave = () => {
    const input: KitchenInput = {
      ...(kitchen ? { id: kitchen.id } : {}),
      ...placeInput(place),
      beneficiaries: { small, large },
      attendanceRate: attendance / 100,
      paymentSlaDays: sla,
      ...(perms.isAdmin ? { linkedKopdesIds: linked, kopdesOrderShare: Object.fromEntries(linked.map((id) => [id, (shares[id] ?? 0) / 100])) } : {}),
    };
    save("saveKitchen", [input]);
    onDone();
  };

  return (
    <FormCard title={kitchen ? s.editTitle(kitchen.name) : s.newKitchen} onSave={onSave} onCancel={onDone} canSave={valid} testId="kitchen-form">
      <PlaceFields prefix={prefix} value={place} onChange={setPlace} />
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField id={`${prefix}-small`} label={t.manage.kitchens.small} value={small} onValue={setSmall} min={0} max={20000} step={1} />
        <NumberField id={`${prefix}-large`} label={t.manage.kitchens.large} value={large} onValue={setLarge} min={0} max={20000} step={1} />
        <NumberField id={`${prefix}-attendance`} label={t.manage.kitchens.attendance} value={attendance} onValue={setAttendance} min={50} max={100} step={1} />
        <NumberField id={`${prefix}-sla`} label={t.manage.kitchens.sla} value={sla} onValue={setSla} min={1} max={60} step={1} />
      </div>
      <fieldset className="grid gap-2" aria-describedby={`${prefix}-share-hint`}>
        <legend className="mb-1 text-sm font-semibold">{t.manage.kitchens.kopdes}</legend>
        <p id={`${prefix}-share-hint`} className="text-xs text-muted">
          {t.manage.kitchens.shareHint}
        </p>
        {perms.isAdmin ? (
          data.kopdes.length === 0 ? (
            <p className="text-sm text-muted">{s.noKopdesYet}</p>
          ) : (
            <div className="grid items-start gap-2 sm:grid-cols-2">
              {data.kopdes.map((kd) => {
                const on = linked.includes(kd.id);
                return (
                  <div key={kd.id} role="group" aria-label={kd.name} className="grid gap-2">
                    <CheckboxRow id={`${prefix}-link-${kd.id}`} checked={on} onChange={(v) => toggle(kd.id, v)} testId={`${prefix}-link-${kd.id}`}>
                      {kd.name}
                    </CheckboxRow>
                    {on ? (
                      <NumberField
                        id={`${prefix}-share-${kd.id}`}
                        label={t.manage.kitchens.share}
                        value={shares[kd.id] ?? 0}
                        onValue={(v) => setShares({ ...shares, [kd.id]: v })}
                        min={0}
                        max={100}
                        step={1}
                        className="pl-3"
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <>
            <p className="text-sm">
              {linked.length === 0
                ? s.noLinks
                : linked.map((id) => `${data.kopdes.find((kd) => kd.id === id)?.name ?? id} ${formatPct((shares[id] ?? 0) / 100, lang)}`).join(", ")}
            </p>
            <p className="text-xs text-muted">{t.manage.adminOnly}</p>
          </>
        )}
        {perms.isAdmin && linked.length > 1 ? <p className="text-sm text-muted">{s.shareTotal(formatPct(total / 100, lang))}</p> : null}
      </fieldset>
      {kitchen ? null : <p className="rounded-xl bg-muted-surface p-3 text-sm">{t.manage.kitchens.menuNote}</p>}
    </FormCard>
  );
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function CalendarForm({ kitchen, onDone }: { kitchen: Kitchen; onDone: () => void }) {
  const { t, lang, nm } = useT();
  const s = usePlacesStrings();
  const save = useSave();
  const [days, setDays] = useState<number[]>(kitchen.schoolCalendar.operatingWeekdays);
  const [holidays, setHolidays] = useState<Holiday[]>(() => [...kitchen.schoolCalendar.holidays].sort((a, b) => a.date.localeCompare(b.date)));
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const prefix = `cal-${kitchen.id}`;
  const canAdd = DATE_RE.test(date) && !holidays.some((h) => h.date === date);

  const addHoliday = () => {
    if (!canAdd) return;
    const name = reason.trim();
    setHolidays([...holidays, { date, nameEn: name, nameId: name }].sort((a, b) => a.date.localeCompare(b.date)));
    setDate("");
    setReason("");
  };

  return (
    <FormCard
      title={s.calendarTitle(kitchen.name)}
      onSave={() => {
        save("setSchoolCalendar", [kitchen.id, [...days].sort(), holidays]);
        onDone();
      }}
      onCancel={onDone}
      canSave={days.length > 0}
      testId="calendar-form"
    >
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold">{t.manage.kitchens.weekdays}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {WEEKDAYS.map((d) => (
            <CheckboxRow
              key={d}
              id={`${prefix}-day-${d}`}
              checked={days.includes(d)}
              onChange={(on) => setDays(on ? [...days, d] : days.filter((x) => x !== d))}
              testId={`${prefix}-day-${d}`}
            >
              <span className="sm:hidden">{dayName(d, lang)}</span>
              <span className="hidden sm:inline">{dayName(d, lang, true)}</span>
            </CheckboxRow>
          ))}
        </div>
        {days.length === 0 ? (
          <p className="text-sm font-semibold text-danger-strong" role="alert">
            {s.noSchoolDays}
          </p>
        ) : null}
      </fieldset>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-semibold">{t.manage.kitchens.holidays}</legend>
        {holidays.length === 0 ? <p className="text-sm text-muted">{s.noHolidays}</p> : null}
        <ul className="grid gap-1.5">
          {holidays.map((h) => {
            const when = formatDate(h.date, lang, { weekday: true, year: true });
            return (
              <li key={h.date} className="flex items-center gap-2 rounded-xl border border-border px-3 py-1">
                <span className="min-w-0 flex-1 text-sm">
                  <span className="font-semibold">{when}</span>
                  {nm(h) ? <span className="text-muted"> {nm(h)}</span> : null}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={s.removeHoliday(when)}
                  onClick={() => setHolidays(holidays.filter((x) => x.date !== h.date))}
                  className="text-danger-strong hover:bg-danger-soft"
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
        <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-end">
          <Field id={`${prefix}-date`} label={s.date} type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid={`${prefix}-date`} />
          <Field
            id={`${prefix}-reason`}
            label={t.manage.kitchens.holidayName}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addHoliday();
              }
            }}
            data-testid={`${prefix}-reason`}
          />
          <Button type="button" variant="outline" onClick={addHoliday} disabled={!canAdd} data-testid={`${prefix}-add-holiday`}>
            {t.manage.kitchens.addHoliday}
          </Button>
        </div>
      </fieldset>
    </FormCard>
  );
}
