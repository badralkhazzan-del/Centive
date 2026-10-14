"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, MessageCircle, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/common/toast";
import { formatDateTime } from "@/engines/format";
import { useT } from "@/i18n";
import { api, ApiError } from "@/lib/live-client";
import { useAppData } from "@/lib/repo";
import { whatsappLink } from "@/lib/whatsapp";
import type { LiveUser } from "@/lib/repo";
import { AddButton, Field, FormCard, RecordRow, Section, SelectField, usePermissions } from "./parts";

type UserRole = LiveUser["role"];

interface PublicUser {
  id: string;
  name: string;
  login: string | null;
  role: UserRole;
  entityId: string | null;
  invitePending: boolean;
  inviteExpires: string | null;
  createdAt: string;
  lastLogin: string | null;
}

function InviteLink({ url, name, phone }: { url: string; name: string; phone?: string }) {
  const { t } = useT();
  const data = useAppData();
  const notify = useToast();
  const message = t.manage.team.message(name, data.workspace?.name ?? "PiringTani", url);
  return (
    <div className="grid gap-2 rounded-xl bg-ok-soft p-3" data-testid="invite-link">
      <p className="text-sm font-semibold text-ok-strong">{t.manage.team.created}</p>
      <code className="block overflow-x-auto rounded-lg bg-surface px-3 py-2 text-sm">{url}</code>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void navigator.clipboard?.writeText(url).then(() => notify(t.manage.team.copied));
          }}
        >
          <Copy aria-hidden /> {t.manage.team.copy}
        </Button>
        <Button asChild size="sm">
          <a href={whatsappLink(message, phone)} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden /> {t.manage.team.whatsapp}
          </a>
        </Button>
      </div>
    </div>
  );
}

export function TeamTab() {
  const { t, lang } = useT();
  const data = useAppData();
  const perms = usePermissions();
  const notify = useToast();
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<{ name: string; role: UserRole; entityId: string }>({ name: "", role: perms.isAdmin ? "kitchen" : "farmer", entityId: "" });
  const [links, setLinks] = useState<Record<string, string>>({});
  const L = t.manage.team;

  const load = useCallback(() => {
    api<{ users: PublicUser[] }>("/api/users")
      .then((r) => setUsers(r.users))
      .catch(() => undefined);
  }, []);
  useEffect(load, [load]);

  const fail = (e: unknown) => {
    const code = (e instanceof ApiError ? e.code : "server_error") as keyof typeof t.live.errors;
    notify(t.live.errors[code] ?? t.live.errors.server_error, "info");
  };
  const joinUrl = (token: string) => `${window.location.origin}/join?token=${token}`;

  const roles: UserRole[] = perms.isAdmin ? ["admin", "kitchen", "kopdes", "farmer", "viewer"] : ["farmer"];
  const entities = (role: UserRole) =>
    role === "kitchen"
      ? data.kitchens.map((k) => ({ id: k.id, name: k.name }))
      : role === "kopdes"
        ? data.kopdes.map((k) => ({ id: k.id, name: k.name }))
        : role === "farmer"
          ? data.farmers.filter((f) => perms.isAdmin || f.kopdesId === perms.user?.entityId).map((f) => ({ id: f.id, name: `${f.displayName} · ${f.village}` }))
          : [];
  const needsEntity = form.role === "kitchen" || form.role === "kopdes" || form.role === "farmer";
  const entityName = (u: { role: UserRole; entityId: string | null }) => entities(u.role).find((e) => e.id === u.entityId)?.name;
  const phoneOf = (u: { role: UserRole; entityId: string | null }) => (u.role === "farmer" ? data.farmers.find((f) => f.id === u.entityId)?.phone : undefined);

  const create = async () => {
    try {
      const r = await api<{ id: string; token: string }>("/api/users", { body: { name: form.name, role: form.role, entityId: needsEntity ? form.entityId : null } });
      setLinks((l) => ({ ...l, [r.id]: joinUrl(r.token) }));
      setAdding(false);
      setForm({ ...form, name: "", entityId: "" });
      load();
    } catch (e) {
      fail(e);
    }
  };

  return (
    <Section title={L.title} hint={L.hint} action={!adding ? <AddButton onClick={() => setAdding(true)} label={L.invite} testId="team-invite" /> : undefined}>
      {adding ? (
        <FormCard title={L.invite} onSave={create} onCancel={() => setAdding(false)} canSave={Boolean(form.name.trim()) && (!needsEntity || Boolean(form.entityId))} testId="team-form">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="team-name" label={t.manage.name} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <SelectField id="team-role" label={L.role} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole, entityId: "" })}>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {t.live.roleLabel[r]}
                </option>
              ))}
            </SelectField>
            {needsEntity ? (
              <SelectField id="team-entity" label={L.linkedTo} value={form.entityId} onChange={(e) => setForm({ ...form, entityId: e.target.value })}>
                <option value="">{L.choose}</option>
                {entities(form.role).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </SelectField>
            ) : null}
          </div>
          {needsEntity && entities(form.role).length === 0 ? <p className="text-sm font-semibold text-warn-strong">{L.needEntity}</p> : null}
        </FormCard>
      ) : null}
      <ul className="grid gap-3">
        {users.map((u) => {
          const self = u.id === perms.user?.id;
          return (
            <RecordRow
              key={u.id}
              testId={`user-${u.id}`}
              title={
                <span className="flex flex-wrap items-center gap-2">
                  {u.name} {self ? <span className="text-sm font-normal text-muted">({L.you})</span> : null}
                  <Badge variant={u.invitePending ? "yellow" : "green"}>{u.invitePending ? L.pending : L.active}</Badge>
                </span>
              }
              meta={
                <>
                  {t.live.roleLabel[u.role]}
                  {entityName(u) ? ` · ${entityName(u)}` : ""}
                  {u.login ? ` · ${u.login}` : ""}
                  {u.lastLogin ? ` · ${L.lastLogin(formatDateTime(u.lastLogin, lang))}` : ""}
                </>
              }
              removeName={u.name}
              onRemove={
                self
                  ? undefined
                  : () => {
                      api(`/api/users/${u.id}`, { method: "DELETE" })
                        .then(load)
                        .catch(fail);
                    }
              }
            >
              {links[u.id] ? <InviteLink url={links[u.id]} name={u.name} phone={phoneOf(u)} /> : null}
              {!self && !links[u.id] ? (
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      api<{ token: string }>(`/api/users/${u.id}`, { method: "POST" })
                        .then((r) => setLinks((l) => ({ ...l, [u.id]: joinUrl(r.token) })))
                        .catch(fail);
                    }}
                  >
                    {u.invitePending ? <UserPlus aria-hidden /> : <KeyRound aria-hidden />} {u.invitePending ? L.link : L.reset}
                  </Button>
                </div>
              ) : null}
            </RecordRow>
          );
        })}
      </ul>
    </Section>
  );
}
