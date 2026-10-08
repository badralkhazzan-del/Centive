import { cn } from "@/lib/utils";

export function PageContainer({ className, narrow, children }: { className?: string; narrow?: boolean; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full px-4 py-6 sm:py-8", narrow ? "max-w-[480px] village" : "max-w-7xl", className)}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="space-y-1">
        {eyebrow ? <div className="text-sm font-semibold text-muted">{eyebrow}</div> : null}
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        {subtitle ? <p className="max-w-2xl text-base text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
