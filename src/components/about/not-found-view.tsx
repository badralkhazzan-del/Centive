"use client";

import Link from "next/link";
import { ArrowRight, House, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleIcon } from "@/components/layout/role-icon";
import { useT } from "@/i18n";
import { actions } from "@/lib/repo";
import { ROLE_HOME } from "@/lib/roles";
import type { Role } from "@/types";
import { StatusScreen } from "./status-screen";

const ROLES: Role[] = ["kitchen", "kopdes", "farmer", "regency"];

export function NotFoundView() {
  const { t } = useT();
  return (
    <StatusScreen
      testId="not-found"
      eyebrow="404"
      badge={<SearchX />}
      title={t.common.notFoundTitle}
      body={t.common.notFoundBody}
      actions={
        <Button size="lg" asChild>
          <Link href="/">
            <House aria-hidden /> {t.common.goHome}
          </Link>
        </Button>
      }
    >
      <nav aria-labelledby="not-found-roles" className="mt-8">
        <h2 id="not-found-roles" className="text-lg font-bold text-foreground">
          {t.landing.chooseRole}
        </h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {ROLES.map((r) => (
            <li key={r}>
              <Link
                href={ROLE_HOME[r]}
                onClick={() => actions.setRole(r)}
                className="group flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-2 font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-muted-surface focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <RoleIcon role={r} className="size-5" />
                </span>
                <span className="min-w-0 flex-1">{t.roles[r].name}</span>
                <ArrowRight className="size-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </StatusScreen>
  );
}
