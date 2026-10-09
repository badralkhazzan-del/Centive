"use client";

import { useMemo, useState } from "react";
import { Cog, ScrollText } from "lucide-react";
import type { AuditLog, Role } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Label, Select } from "@/components/ui/input";
import { RoleIcon } from "@/components/layout/role-icon";
import { formatDateTime } from "@/engines/format";
import { useT } from "@/i18n";
import { useAppData } from "@/lib/repo";
import { cn } from "@/lib/utils";
import { IconTile, ScrollTable, TD, TH } from "./parts";
import { settingsStrings } from "./strings";

const PAGE = 25;
const ROLES: Role[] = ["kitchen", "kopdes", "farmer", "regency"];
type Actor = AuditLog["actorRole"];

/** "menu_switch_approved" -> "Menu switch approved". */
export function prettifyAction(code: string): string {
  const words = code.replace(/[_-]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : code;
}

function ActorIcon({ actor }: { actor: Actor }) {
  return actor === "system" ? <Cog className="size-4 shrink-0 text-muted" aria-hidden /> : <RoleIcon role={actor} className="size-4 shrink-0 text-primary" />;
}

export function AuditTab() {
  const { t, lang } = useT();
  const data = useAppData();
  const L = settingsStrings(lang);
  const S = t.settings;
  const [filter, setFilter] = useState<Actor | "all">("all");
  const [limit, setLimit] = useState(PAGE);

  // Newest first; entries with the same timestamp keep the log's own order (newest first).
  const sorted = useMemo(
    () =>
      data.auditLog
        .map((e, i) => ({ e, i }))
        .sort((a, b) => b.e.timestamp.localeCompare(a.e.timestamp) || a.i - b.i)
        .map((x) => x.e),
    [data.auditLog],
  );
  const rows = filter === "all" ? sorted : sorted.filter((e) => e.actorRole === filter);
  const actorName = (a: Actor) => (a === "system" ? L.system : t.roles[a].name);
  const actors: Actor[] = [...ROLES.filter((r) => data.auditLog.some((e) => e.actorRole === r)), "system"];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid gap-1">
            <h2 className="flex flex-wrap items-center gap-2.5 text-lg leading-tight font-bold">
              <IconTile icon={ScrollText} />
              {L.auditTitle}
              <Badge variant="muted" data-testid="audit-count">
                {L.entries(rows.length)}
              </Badge>
            </h2>
            <CardDescription>{L.auditHint}</CardDescription>
          </div>
          <div className="grid gap-1.5 sm:w-60">
            <Label htmlFor="audit-filter">{L.filterRole}</Label>
            <Select
              id="audit-filter"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value as Actor | "all");
                setLimit(PAGE);
              }}
            >
              <option value="all">{t.common.all}</option>
              {actors.map((a) => (
                <option key={a} value={a}>
                  {actorName(a)}
                </option>
              ))}
            </Select>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-4">
          {rows.length === 0 ? (
            <p className="rounded-xl bg-muted-surface p-4 text-muted" data-testid="audit-empty">
              {S.auditEmpty}
            </p>
          ) : (
            <ScrollTable label={L.auditTitle} className="hidden md:block">
              <table className="w-full min-w-[760px] text-sm" data-testid="audit-table">
                <caption className="sr-only">{L.auditHint}</caption>
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className={cn(TH, "w-44")}>
                      {S.when}
                    </th>
                    <th scope="col" className={cn(TH, "w-48")}>
                      {S.actor}
                    </th>
                    <th scope="col" className={cn(TH, "w-52")}>
                      {S.action}
                    </th>
                    <th scope="col" className={TH}>
                      {S.details}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, limit).map((e) => (
                    <tr key={e.id} className="border-b border-border last:border-0" data-testid={`audit-${e.id}`}>
                      <td className={cn(TD, "whitespace-nowrap tabular-nums text-muted")}>
                        <time dateTime={e.timestamp}>{formatDateTime(e.timestamp, lang)}</time>
                      </td>
                      <td className={TD}>
                        <span className="inline-flex items-center gap-1.5 font-semibold">
                          <ActorIcon actor={e.actorRole} />
                          {actorName(e.actorRole)}
                        </span>
                      </td>
                      <td className={cn(TD, "font-semibold")}>
                        <span title={e.action}>{L.actionNames[e.action] ?? prettifyAction(e.action)}</span>
                      </td>
                      <td className={TD} lang="en">
                        {e.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollTable>
          )}
          {rows.length > 0 ? (
            <ol className="grid md:hidden" aria-label={L.auditTitle} data-testid="audit-list">
              {rows.slice(0, limit).map((e) => (
                <li key={e.id} className="grid gap-1 border-b border-border py-3 first:pt-0 last:border-0">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span className="font-bold">{L.actionNames[e.action] ?? prettifyAction(e.action)}</span>
                    <time dateTime={e.timestamp} className="text-xs text-muted tabular-nums">
                      {formatDateTime(e.timestamp, lang)}
                    </time>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted">
                    <ActorIcon actor={e.actorRole} />
                    {actorName(e.actorRole)}
                  </span>
                  <p className="text-sm" lang="en">
                    {e.details}
                  </p>
                </li>
              ))}
            </ol>
          ) : null}
          {rows.length > limit ? (
            <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)} className="justify-self-start">
              {L.showMore(Math.min(PAGE, rows.length - limit))}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
