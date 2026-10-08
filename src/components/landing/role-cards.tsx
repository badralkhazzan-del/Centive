"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { RoleIcon } from "@/components/layout/role-icon";
import { useT } from "@/i18n";
import { actions } from "@/lib/repo";
import { ROLE_HOME } from "@/lib/roles";
import type { Role } from "@/types";

const ROLES: Role[] = ["kitchen", "kopdes", "farmer", "regency"];

export function RoleCards() {
  const { t } = useT();
  return (
    <ul className="grid gap-3 sm:grid-cols-2" aria-label={t.landing.chooseRole}>
      {ROLES.map((r) => (
        <li key={r}>
          <Link
            href={ROLE_HOME[r]}
            onClick={() => actions.setRole(r)}
            data-testid={`role-card-${r}`}
            className="group flex h-full min-h-36 flex-col gap-3 rounded-2xl border border-border bg-surface p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
          >
            <span className="flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <RoleIcon role={r} className="size-6" />
              </span>
              <span className="flex flex-col">
                <span className="text-lg font-bold leading-tight text-foreground">{t.roles[r].name}</span>
                <span className="text-sm text-muted">{t.roles[r].device}</span>
              </span>
            </span>
            <span className="text-base text-foreground">{t.roles[r].job}</span>
            <span className="mt-auto inline-flex items-center gap-1 text-sm font-bold text-primary">
              {t.landing.open}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
