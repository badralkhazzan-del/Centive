"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Building2, Database, KeyRound, LogIn, Sparkles } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useT } from "@/i18n";
import { api, ApiError, reloadTo } from "@/lib/live-client";
import { cn } from "@/lib/utils";

type ErrorCode = keyof ReturnType<typeof useT>["t"]["live"]["errors"];

function useErrorText() {
  const { t } = useT();
  return (e: unknown) => {
    const code = (e instanceof ApiError ? e.code : "server_error") as ErrorCode;
    return t.live.errors[code] ?? t.live.errors.server_error;
  };
}

/** Whether this deployment has a database for live workspaces. */
function useLiveAvailable() {
  const [live, setLive] = useState<boolean | null>(null);
  useEffect(() => {
    api<{ live: boolean }>("/api/status")
      .then((r) => setLive(r.live))
      .catch(() => setLive(true));
  }, []);
  return live;
}

function AuthShell({ title, subtitle, children, icon: Icon = LogIn }: { title: string; subtitle?: string; children: React.ReactNode; icon?: typeof LogIn }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <div className="grid gap-5 rounded-2xl border border-border bg-surface p-6 shadow-soft sm:p-8">
        <div className="flex items-center gap-3">
          <LogoMark className="size-11" />
          <Icon className="size-5 text-primary" aria-hidden />
        </div>
        <div className="grid gap-1">
          <h1 className="text-2xl font-extrabold">{title}</h1>
          {subtitle ? <p className="text-muted">{subtitle}</p> : null}
        </div>
        {children}
      </div>
    </div>
  );
}

function ErrorLine({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm font-semibold text-danger-strong">
      {text}
    </p>
  );
}

function NoDatabase() {
  const { t } = useT();
  return (
    <AuthShell title={t.live.noDbTitle} icon={Database}>
      <p className="text-muted">{t.live.noDbBody}</p>
      <Button asChild variant="accent">
        <Link href="/">{t.common.goHome}</Link>
      </Button>
    </AuthShell>
  );
}

function Field({ id, label, hint, ...props }: { id: string; label: string; hint?: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} aria-describedby={hint ? `${id}-hint` : undefined} />
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function LoginForm() {
  const { t } = useT();
  const live = useLiveAvailable();
  const params = useSearchParams();
  const errorText = useErrorText();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(params.get("expired") ? t.live.expired : null);
  const [busy, setBusy] = useState(false);
  if (live === false) return <NoDatabase />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/login", { body: { login, password } });
      reloadTo(params.get("next")?.startsWith("/") ? params.get("next")! : "/");
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <AuthShell title={t.live.loginTitle} subtitle={t.live.loginSubtitle}>
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <Field id="login" label={t.live.loginLabel} hint={t.live.loginHint} value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" required />
        <Field id="password" type="password" label={t.live.password} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        <ErrorLine text={error} />
        <Button type="submit" size="lg" disabled={busy || !login || !password} data-testid="login-submit">
          <LogIn aria-hidden /> {busy ? t.live.working : t.live.submitLogin}
        </Button>
      </form>
      <p className="text-sm text-muted">{t.live.forgot}</p>
      <p className="text-sm">
        {t.live.noAccount}{" "}
        <Link className="font-semibold text-primary underline-offset-4 hover:underline" href="/signup">
          {t.live.createWorkspace}
        </Link>
      </p>
    </AuthShell>
  );
}

export function SignupForm() {
  const { t } = useT();
  const live = useLiveAvailable();
  const errorText = useErrorText();
  const [form, setForm] = useState({ workspaceName: "", region: "", name: "", login: "", password: "" });
  const [start, setStart] = useState<"sample" | "empty">("empty");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (live === false) return <NoDatabase />;
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/setup", { body: { ...form, start } });
      reloadTo("/manage");
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  const options = [
    { value: "empty" as const, title: t.live.startEmpty, body: t.live.startEmptyBody, Icon: Building2 },
    { value: "sample" as const, title: t.live.startSample, body: t.live.startSampleBody, Icon: Sparkles },
  ];

  return (
    <AuthShell title={t.live.setupTitle} subtitle={t.live.setupSubtitle} icon={Building2}>
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <Field id="ws" label={t.live.workspaceName} hint={t.live.workspaceHint} value={form.workspaceName} onChange={set("workspaceName")} required />
        <Field id="region" label={t.live.region} hint={t.live.regionHint} value={form.region} onChange={set("region")} />
        <Field id="name" label={t.live.yourName} value={form.name} onChange={set("name")} autoComplete="name" required />
        <Field id="login" label={t.live.loginLabel} value={form.login} onChange={set("login")} autoComplete="username" required />
        <Field id="password" type="password" label={t.live.password} hint={t.live.passwordHint} value={form.password} onChange={set("password")} autoComplete="new-password" required />
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-semibold">{t.live.startWith}</legend>
          {options.map(({ value, title, body, Icon }) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-3 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring",
                start === value ? "border-primary bg-primary-soft" : "border-border",
              )}
            >
              <input type="radio" name="start" value={value} checked={start === value} onChange={() => setStart(value)} className="mt-1 size-4 accent-[var(--primary)]" />
              <span className="grid gap-0.5">
                <span className="flex items-center gap-1.5 font-semibold">
                  <Icon className="size-4 text-primary" aria-hidden /> {title}
                </span>
                <span className="text-sm text-muted">{body}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <ErrorLine text={error} />
        <Button type="submit" size="lg" disabled={busy || !form.workspaceName || !form.name || !form.login || !form.password} data-testid="signup-submit">
          <Building2 aria-hidden /> {busy ? t.live.working : t.live.submitSetup}
        </Button>
      </form>
      <p className="text-sm">
        {t.live.haveAccount}{" "}
        <Link className="font-semibold text-primary underline-offset-4 hover:underline" href="/login">
          {t.live.signIn}
        </Link>
      </p>
    </AuthShell>
  );
}

interface InviteInfo {
  name: string;
  role: "admin" | "kitchen" | "kopdes" | "farmer" | "viewer";
  workspaceName: string;
  login: string | null;
}

export function JoinForm() {
  const { t } = useT();
  const params = useSearchParams();
  const errorText = useErrorText();
  const token = params.get("token") ?? "";
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ invite: InviteInfo }>(`/api/auth/invite?token=${encodeURIComponent(token)}`)
      .then((r) => {
        setInfo(r.invite);
        if (r.invite.login) setLogin(r.invite.login);
      })
      .catch((e) => setLoadError(errorText(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (loadError) {
    return (
      <AuthShell title={t.live.loginTitle} icon={KeyRound}>
        <ErrorLine text={loadError} />
        <Button asChild variant="outline">
          <Link href="/login">{t.live.signIn}</Link>
        </Button>
      </AuthShell>
    );
  }
  if (!info) {
    return (
      <AuthShell title={t.live.working} icon={KeyRound}>
        <div className="h-40" aria-busy="true" />
      </AuthShell>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/invite", { body: { token, login, password } });
      reloadTo("/");
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };

  return (
    <AuthShell title={t.live.joinTitle(info.workspaceName)} subtitle={t.live.joinSubtitle(info.name, t.live.roleLabel[info.role])} icon={KeyRound}>
      <form className="grid gap-4" onSubmit={submit} noValidate>
        <Field id="login" label={t.live.loginLabel} hint={t.live.loginHint} value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" required />
        <Field id="password" type="password" label={t.live.newPassword} hint={t.live.passwordHint} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
        <ErrorLine text={error} />
        <Button type="submit" size="lg" disabled={busy || !login || !password} data-testid="join-submit">
          <KeyRound aria-hidden /> {busy ? t.live.working : t.live.submitJoin}
        </Button>
      </form>
    </AuthShell>
  );
}
