"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { useToast } from "@/components/common/toast";
import { useT } from "@/i18n";
import { actions, useLiveUser } from "@/lib/repo";
import { cn } from "@/lib/utils";

// Shared building blocks for the Manage tabs. Every change goes through
// actions.exec(commandName, args), the same registry the server runs.

/** Run a registry command and confirm with a toast. */
export function useSave() {
  const notify = useToast();
  const { t } = useT();
  return (name: string, args: unknown[], message: string = t.manage.saved) => {
    actions.exec(name, args);
    notify(message);
  };
}

/** What the current person may edit. Admins edit everything; others only their own records. */
export function usePermissions() {
  const user = useLiveUser();
  const role = user?.role ?? "admin";
  const own = user?.entityId ?? null;
  return {
    user,
    isAdmin: role === "admin",
    role,
    canEditKitchen: (id?: string) => role === "admin" || (role === "kitchen" && id === own),
    canEditKopdes: (id?: string) => role === "admin" || (role === "kopdes" && id === own),
    canEditFarmersOf: (kopdesId?: string) => role === "admin" || (role === "kopdes" && kopdesId === own),
    canEditLibrary: role === "admin" || role === "kitchen" || role === "kopdes",
    canEditPrices: role === "admin" || role === "kopdes",
    canEditIngredients: role === "admin",
  };
}

export function Section({ title, hint, action, children }: { title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          {hint ? <p className="max-w-2xl text-sm text-muted">{hint}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Field({
  id,
  label,
  hint,
  className,
  ...props
}: { id: string; label: string; hint?: string; className?: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-describedby={hint ? `${id}-hint` : undefined} {...props} />
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField({
  id,
  label,
  hint,
  className,
  children,
  ...props
}: { id: string; label: string; hint?: string; className?: string } & React.ComponentProps<typeof Select>) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Select id={id} aria-describedby={hint ? `${id}-hint` : undefined} {...props}>
        {children}
      </Select>
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Number input that keeps what the user types until it is a valid number. */
export function NumberField({
  id,
  label,
  value,
  onValue,
  hint,
  min,
  max,
  step,
  className,
}: {
  id: string;
  label: string;
  value: number;
  onValue: (v: number) => void;
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}) {
  const [text, setText] = useState(String(value));
  const [last, setLast] = useState(value);
  if (last !== value) {
    setLast(value);
    setText(String(value));
  }
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      className={className}
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value !== "" && Number.isFinite(n)) onValue(n);
      }}
    />
  );
}

/** A row in a list of records, with Edit and Remove buttons. */
export function RecordRow({
  title,
  meta,
  onEdit,
  onRemove,
  removeName,
  testId,
  children,
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  onEdit?: () => void;
  onRemove?: () => void;
  removeName?: string;
  testId?: string;
  children?: React.ReactNode;
}) {
  const { t } = useT();
  return (
    <li className="grid gap-2 rounded-2xl border border-border bg-surface p-4 shadow-soft" data-testid={testId}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-bold">{title}</div>
          {meta ? <div className="text-sm text-muted">{meta}</div> : null}
        </div>
        <div className="flex gap-1">
          {onEdit ? (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil aria-hidden /> {t.manage.edit}
            </Button>
          ) : null}
          {onRemove ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`${t.manage.remove}: ${removeName ?? ""}`}
              onClick={() => {
                if (window.confirm(t.manage.confirmRemove(removeName ?? ""))) onRemove();
              }}
              className="text-danger-strong hover:bg-danger-soft"
            >
              <Trash2 aria-hidden />
            </Button>
          ) : null}
        </div>
      </div>
      {children}
    </li>
  );
}

export function AddButton({ onClick, label, testId }: { onClick: () => void; label?: string; testId?: string }) {
  const { t } = useT();
  return (
    <Button onClick={onClick} data-testid={testId}>
      <Plus aria-hidden /> {label ?? t.manage.add}
    </Button>
  );
}

/** Card holding an add/edit form with Save and Cancel. */
export function FormCard({
  title,
  onSave,
  onCancel,
  canSave = true,
  children,
  testId,
}: {
  title: string;
  onSave: () => void;
  onCancel: () => void;
  canSave?: boolean;
  children: React.ReactNode;
  testId?: string;
}) {
  const { t } = useT();
  return (
    <form
      className="grid gap-4 rounded-2xl border-2 border-primary/40 bg-surface p-4 shadow-soft sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) onSave();
      }}
      data-testid={testId}
    >
      <h3 className="text-lg font-bold">{title}</h3>
      {children}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!canSave} data-testid={testId ? `${testId}-save` : undefined}>
          {t.manage.save}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t.manage.cancel}
        </Button>
      </div>
    </form>
  );
}

export function EmptyList() {
  const { t } = useT();
  return <p className="rounded-2xl border border-dashed border-border-strong bg-surface p-6 text-center text-muted">{t.manage.none}</p>;
}
