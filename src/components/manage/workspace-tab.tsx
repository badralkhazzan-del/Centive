"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/common/toast";
import { useT } from "@/i18n";
import { api, ApiError } from "@/lib/live-client";
import { repo, useAppData, useGuest } from "@/lib/repo";
import { Field, FormCard, Section } from "./parts";

export function WorkspaceTab() {
  const guest = useGuest();
  const { t } = useT();
  const data = useAppData();
  const notify = useToast();
  const [name, setName] = useState(data.workspace?.name ?? "");
  const [region, setRegion] = useState(data.workspace?.region ?? "");
  const [busy, setBusy] = useState(false);
  const L = t.manage.workspace;

  const fail = (e: unknown) => {
    const code = (e instanceof ApiError ? e.code : "server_error") as keyof typeof t.live.errors;
    notify(t.live.errors[code] ?? t.live.errors.server_error, "info");
  };

  const rename = async () => {
    try {
      await api("/api/workspace", { body: { action: "rename", name, region } });
      await repo.refresh();
      notify(t.manage.saved);
    } catch (e) {
      fail(e);
    }
  };

  const reset = async (start: "sample" | "empty") => {
    if (!window.confirm(L.confirmReset)) return;
    setBusy(true);
    try {
      await api("/api/workspace", { body: { action: "reset", start } });
      await repo.refresh();
      notify(L.done);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-8">
      <Section title={L.title}>
        <FormCard title={L.rename} onSave={rename} onCancel={() => (setName(data.workspace?.name ?? ""), setRegion(data.workspace?.region ?? ""))} canSave={Boolean(name.trim())}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="ws-name" label={t.live.workspaceName} value={name} onChange={(e) => setName(e.target.value)} required />
            <Field id="ws-region" label={t.live.region} value={region} onChange={(e) => setRegion(e.target.value)} />
          </div>
          <p className="text-sm text-muted">
            {L.timezone}: {data.workspace?.timezone}
          </p>
        </FormCard>
      </Section>
      {/* Guest copies have no password. */}
      {guest ? null : <PasswordCard />}
      <Section title={L.startOver} hint={L.startOverHint}>
        <div className="flex flex-wrap gap-2 rounded-2xl border border-danger/30 bg-danger-soft/40 p-4">
          <Button variant="outline" disabled={busy} onClick={() => reset("sample")} data-testid="reset-sample">
            <RotateCcw aria-hidden /> {L.resetSample}
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => reset("empty")} className="border-danger/40 text-danger-strong hover:bg-danger-soft" data-testid="reset-empty">
            <RotateCcw aria-hidden /> {L.resetEmpty}
          </Button>
        </div>
      </Section>
    </div>
  );
}

/** Change your own password (any signed-in role that can open Manage). */
export function PasswordCard() {
  const { t } = useT();
  const notify = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const submit = async () => {
    try {
      await api("/api/auth/password", { body: { current, next } });
      setCurrent("");
      setNext("");
      notify(t.live.passwordChanged);
    } catch (e) {
      const code = (e instanceof ApiError ? e.code : "server_error") as keyof typeof t.live.errors;
      notify(t.live.errors[code] ?? t.live.errors.server_error, "info");
    }
  };
  return (
    <FormCard title={t.live.changePassword} onSave={submit} onCancel={() => (setCurrent(""), setNext(""))} canSave={current.length > 0 && next.length >= 6}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="pw-current" type="password" autoComplete="current-password" label={t.live.currentPassword} value={current} onChange={(e) => setCurrent(e.target.value)} />
        <Field id="pw-next" type="password" autoComplete="new-password" label={t.live.newPassword} hint={t.live.passwordHint} value={next} onChange={(e) => setNext(e.target.value)} />
      </div>
    </FormCard>
  );
}
