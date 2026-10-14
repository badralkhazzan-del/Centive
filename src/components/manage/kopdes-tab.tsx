"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CheckboxRow } from "@/components/ui/checkbox";
import { useT } from "@/i18n";
import { useAppData } from "@/lib/repo";
import type { KopdesInput } from "@/lib/repo/manage";
import type { Kopdes } from "@/types";
import { PlaceFields, placeDraft, placeInput, placeLine, placeValid } from "./kitchens-tab";
import { AddButton, EmptyList, FormCard, RecordRow, Section, usePermissions, useSave } from "./parts";
import { usePlacesStrings } from "./places-strings";

export function KopdesTab() {
  const { t } = useT();
  const s = usePlacesStrings();
  const data = useAppData();
  const perms = usePermissions();
  const save = useSave();
  const [editing, setEditing] = useState<string | null>(null);
  const nameOf = (id: string) => data.kopdes.find((kd) => kd.id === id)?.name ?? id;

  return (
    <Section
      title={t.manage.kopdes.title}
      action={perms.isAdmin && editing !== "new" ? <AddButton label={s.addKopdes} onClick={() => setEditing("new")} testId="kopdes-add" /> : null}
    >
      {editing === "new" ? <KopdesForm onDone={() => setEditing(null)} /> : null}
      {data.kopdes.length === 0 ? (
        editing === "new" ? null : <EmptyList />
      ) : (
        <ul className="grid gap-3">
          {data.kopdes.map((kd) =>
            editing === kd.id ? (
              <li key={kd.id}>
                <KopdesForm kopdes={kd} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <RecordRow
                key={kd.id}
                title={kd.name}
                meta={placeLine(kd)}
                onEdit={perms.canEditKopdes(kd.id) ? () => setEditing(kd.id) : undefined}
                onRemove={perms.isAdmin ? () => save("deleteKopdes", [kd.id]) : undefined}
                removeName={s.withFarmers(kd.name, kd.memberFarmerIds.length)}
                testId={`kopdes-row-${kd.id}`}
              >
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="muted">
                    <Users aria-hidden /> {t.manage.kopdes.members(kd.memberFarmerIds.length)}
                  </Badge>
                  <span className="text-muted">
                    {kd.neighborKopdesIds.length === 0 ? s.noNeighbors : s.neighborsList(kd.neighborKopdesIds.map(nameOf).join(", "))}
                  </span>
                </div>
              </RecordRow>
            ),
          )}
        </ul>
      )}
    </Section>
  );
}

function KopdesForm({ kopdes, onDone }: { kopdes?: Kopdes; onDone: () => void }) {
  const { t } = useT();
  const s = usePlacesStrings();
  const data = useAppData();
  const perms = usePermissions();
  const save = useSave();
  const [place, setPlace] = useState(() => placeDraft(kopdes));
  const [neighbors, setNeighbors] = useState<string[]>(kopdes?.neighborKopdesIds ?? []);
  const others = data.kopdes.filter((kd) => kd.id !== kopdes?.id);
  const prefix = kopdes ? `kopdes-${kopdes.id}` : "kopdes-new";

  const onSave = () => {
    const input: KopdesInput = {
      ...(kopdes ? { id: kopdes.id } : {}),
      ...placeInput(place),
      ...(perms.isAdmin ? { neighborKopdesIds: neighbors } : {}),
    };
    save("saveKopdes", [input]);
    onDone();
  };

  return (
    <FormCard title={kopdes ? s.editTitle(kopdes.name) : s.newKopdes} onSave={onSave} onCancel={onDone} canSave={placeValid(place)} testId="kopdes-form">
      <PlaceFields prefix={prefix} value={place} onChange={setPlace} />
      <fieldset className="grid gap-2" aria-describedby={`${prefix}-neighbors-hint`}>
        <legend className="mb-1 text-sm font-semibold">{t.manage.kopdes.neighbors}</legend>
        <p id={`${prefix}-neighbors-hint`} className="text-xs text-muted">
          {t.manage.kopdes.neighborsHint}
        </p>
        {perms.isAdmin ? (
          others.length === 0 ? (
            <p className="text-sm text-muted">{s.noOtherKopdes}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {others.map((kd) => (
                <CheckboxRow
                  key={kd.id}
                  id={`${prefix}-nb-${kd.id}`}
                  checked={neighbors.includes(kd.id)}
                  onChange={(on) => setNeighbors(on ? [...neighbors, kd.id] : neighbors.filter((x) => x !== kd.id))}
                  testId={`${prefix}-nb-${kd.id}`}
                >
                  {kd.name}
                </CheckboxRow>
              ))}
            </div>
          )
        ) : (
          <>
            <p className="text-sm">{neighbors.length === 0 ? s.noNeighbors : neighbors.map((id) => others.find((kd) => kd.id === id)?.name ?? id).join(", ")}</p>
            <p className="text-xs text-muted">{t.manage.adminOnly}</p>
          </>
        )}
      </fieldset>
    </FormCard>
  );
}
