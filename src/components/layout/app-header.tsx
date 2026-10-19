"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Building2, Download, FlaskConical, Info, LayoutGrid, LogIn, LogOut, Menu, RotateCcw, Settings, Users } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/common/toast";
import { useInstallApp } from "@/components/install/install-app";
import { useT } from "@/i18n";
import { actions, repo, useAppData, useDerived, useLiveMode, useLiveUser } from "@/lib/repo";
import { roleOf } from "@/lib/repo/remote";
import { api, LIVE_COOKIE, reloadTo } from "@/lib/live-client";
import { ROLE_HOME, ROLE_NAV, roleFromPath } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { formatDate } from "@/engines/format";
import type { Role } from "@/types";
import { LanguageToggle } from "./language-toggle";
import { RoleIcon } from "./role-icon";

const ROLES: Role[] = ["kitchen", "kopdes", "farmer", "regency"];

export function AppHeader() {
  const { t, lang } = useT();
  const pathname = usePathname();
  const router = useRouter();
  const data = useAppData();
  const notify = useToast();
  const installer = useInstallApp();
  const pathRole = roleFromPath(pathname);
  const role = pathRole ?? data.ui.role;
  const isLive = useLiveMode();
  const user = useLiveUser();
  const ownRole = user && user.role !== "admin" ? roleOf(user) : null;
  const roles = ownRole ? [ownRole] : ROLES;
  const canManage = isLive && user && user.role !== "farmer" && user.role !== "viewer";
  const guest = Boolean(user?.guest);

  useEffect(() => {
    if (pathRole && pathRole !== data.ui.role) actions.setRole(pathRole);
  }, [pathRole, data.ui.role]);

  // In a live workspace, people only open the screens of their own role.
  useEffect(() => {
    if (!ownRole) return;
    if ((pathRole && pathRole !== ownRole) || (pathname.startsWith("/manage") && !canManage)) router.replace(ROLE_HOME[ownRole]);
  }, [ownRole, pathRole, pathname, canManage, router]);

  const signOut = async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      document.cookie = `${LIVE_COOKIE}=; path=/; max-age=0`;
      reloadTo("/");
    }
  };

  const nav = pathRole ? ROLE_NAV[pathRole] : [];
  const derived = useDerived();
  const pendingSwitch = pathRole === "kitchen" ? (derived.suggestions.get(data.ui.activeKitchenId)?.length ?? 0) : 0;

  const resetSample = async () => {
    if (!window.confirm(t.guest.resetConfirm)) return;
    await api("/api/workspace", { body: { action: "reset", start: "sample" } }).catch(() => undefined);
    await repo.refresh();
    notify(t.guest.resetDone);
    router.push("/explore");
  };

  return (
    <header className="hide-in-poster sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 sm:gap-3">
        <Link href="/" className="inline-flex min-h-11 items-center rounded-xl focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring" aria-label={`${t.common.appName}, ${t.common.landing}`}>
          <Logo compact />
        </Link>
        {isLive ? (
          <span className="hidden max-w-72 items-center gap-1.5 truncate rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary-strong lg:inline-flex" title={t.live.lastSync}>
            <span className="size-2 shrink-0 rounded-full bg-ok" aria-hidden /> {guest ? t.guest.badge : `${t.live.liveBadge} · ${data.workspace?.name ?? ""}`} ·{" "}
            {formatDate(data.today, lang, { weekday: true })}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <Link
            href="/simulation"
            className="hidden min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-foreground hover:bg-muted-surface focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring md:inline-flex"
          >
            <FlaskConical className="size-5 text-primary" aria-hidden />
            {t.common.simulationLab}
          </Link>
          {!isLive && pathname === "/" ? (
            <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
              <Link href="/login" data-testid="header-sign-in">
                <LogIn aria-hidden /> {t.live.signIn}
              </Link>
            </Button>
          ) : null}
          <LanguageToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label={t.common.switchRole} data-testid="role-menu">
                {role ? <RoleIcon role={role} className="size-5 text-primary" /> : <Menu aria-hidden />}
                <span className="hidden max-w-36 truncate md:inline">{role ? t.roles[role].name : t.common.chooseRole}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {user && !guest ? (
                <>
                  <DropdownMenuLabel className="flex flex-col">
                    <span>{t.live.signedInAs(user.name)}</span>
                    <span className="text-xs font-normal text-muted">
                      {t.live.roleLabel[user.role]} · {data.workspace?.name}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                </>
              ) : null}
              {guest && user?.role === "admin" ? (
                <>
                  <DropdownMenuItem onSelect={() => router.push("/explore")} data-testid="menu-explore">
                    <LayoutGrid aria-hidden /> {t.guest.home}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              ) : null}
              <DropdownMenuLabel>{t.common.switchRole}</DropdownMenuLabel>
              {roles.map((r) => (
                <DropdownMenuItem key={r} onSelect={() => router.push(ROLE_HOME[r])} className={cn(r === role && "bg-primary-soft")}>
                  <RoleIcon role={r} className="text-primary" />
                  <span className="flex flex-col">
                    <span className="font-semibold">{t.roles[r].name}</span>
                    <span className="text-xs text-muted">{t.roles[r].job}</span>
                  </span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => router.push("/")}>
                <LayoutGrid aria-hidden /> {t.common.landing}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push("/simulation")}>
                <FlaskConical aria-hidden /> {t.common.simulationLab}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push("/settings")}>
                <Settings aria-hidden /> {t.common.settings}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push("/about")}>
                <Info aria-hidden /> {t.common.about}
              </DropdownMenuItem>
              {installer.available ? (
                <DropdownMenuItem onSelect={installer.install} data-testid="menu-install">
                  <Download aria-hidden /> {t.install.button}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              {canManage ? (
                <DropdownMenuItem onSelect={() => router.push("/manage")} data-testid="menu-manage">
                  <Users aria-hidden /> {t.live.manage}
                </DropdownMenuItem>
              ) : null}
              {guest && user?.role === "admin" ? (
                <>
                  <DropdownMenuItem onSelect={resetSample} data-testid="menu-reset-sample">
                    <RotateCcw aria-hidden /> {t.guest.reset}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => router.push("/signup")}>
                    <Building2 aria-hidden /> {t.live.createWorkspace}
                  </DropdownMenuItem>
                </>
              ) : null}
              {isLive ? (
                <DropdownMenuItem onSelect={signOut} data-testid="sign-out">
                  <LogOut aria-hidden /> {guest ? t.guest.close : t.live.signOut}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => router.push("/login")} data-testid="menu-sign-in">
                  <LogIn aria-hidden /> {t.live.signIn}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {nav.length > 1 ? (
        <nav aria-label={t.nav.roleNav} className="mx-auto max-w-7xl overflow-x-auto px-2 sm:px-4">
          <ul className="flex min-w-max gap-1 pb-1">
            {nav.map((item) => {
              const active = item.href === pathname || (item.href !== ROLE_HOME[pathRole!] && pathname.startsWith(item.href));
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    data-tour={item.tour}
                    className={cn(
                      "inline-flex min-h-11 items-center gap-2 rounded-t-lg border-b-[3px] px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring",
                      active ? "border-primary text-primary-strong" : "border-transparent text-muted hover:text-foreground",
                    )}
                  >
                    {item.label(t)}
                    {item.tour === "nav-switch" && pendingSwitch > 0 ? (
                      <span className="rounded-full bg-accent px-1.5 text-xs text-accent-foreground">{pendingSwitch}</span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
      {installer.dialog}
    </header>
  );
}
