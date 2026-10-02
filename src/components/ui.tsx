import { clsx } from "clsx";
import type { ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        "brut-border brut-shadow rounded-lg bg-surface p-4 sm:p-5",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4 md:mb-8 md:items-end">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-sm font-medium text-muted">{subtitle}</p>
        ) : null}
      </div>
      {action ? (
        <div className="w-full sm:w-auto [&>button]:w-full sm:[&>button]:w-auto [&>div]:w-full sm:[&>div]:w-auto">
          {action}
        </div>
      ) : null}
    </div>
  );
}

const buttonVariants = {
  primary: "bg-orange text-white",
  pink: "bg-pink text-white",
  yellow: "bg-yellow text-ink",
  green: "bg-green text-white",
  ghost: "bg-surface text-ink hover:bg-yellow",
};

export function Button({
  className,
  variant = "ghost",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonVariants;
  size?: "sm" | "md";
}) {
  return (
    <button
      className={clsx(
        "brut-border brut-shadow-sm brut-press inline-flex min-h-11 items-center justify-center gap-2 rounded-md font-bold uppercase tracking-wide disabled:opacity-50 sm:min-h-0",
        size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
        buttonVariants[variant],
        className
      )}
      {...props}
    />
  );
}

export function Badge({
  className,
  color = "yellow",
  children,
}: {
  className?: string;
  color?: "yellow" | "orange" | "pink" | "green" | "muted";
  children: React.ReactNode;
}) {
  const colors: Record<string, string> = {
    yellow: "bg-yellow text-ink",
    orange: "bg-orange text-white",
    pink: "bg-pink text-white",
    green: "bg-green text-white",
    muted: "bg-background text-muted",
  };
  return (
    <span
      className={clsx(
        "brut-border inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide",
        colors[color],
        className
      )}
    >
      {children}
    </span>
  );
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      suppressHydrationWarning
      className={clsx(
        "brut-border min-h-11 w-full rounded-md bg-surface px-3 py-2 text-base font-medium placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-orange sm:text-sm",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      suppressHydrationWarning
      className={clsx(
        "brut-border w-full rounded-md bg-surface px-3 py-2 text-base font-medium placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-orange sm:text-sm",
        className
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      suppressHydrationWarning
      className={clsx(
        "brut-border min-h-11 w-full rounded-md bg-surface px-3 py-2 text-base font-bold focus:outline-none focus:ring-2 focus:ring-orange sm:text-sm",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function ProgressBar({
  value,
  color = "orange",
}: {
  value: number;
  color?: "orange" | "green" | "pink";
}) {
  const colors = { orange: "bg-orange", green: "bg-green", pink: "bg-pink" };
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="brut-border h-4 w-full overflow-hidden rounded-full bg-surface">
      <div
        className={clsx("h-full transition-all", colors[color])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="brut-border rounded-lg border-dashed bg-surface/60 p-6 text-center text-sm font-semibold text-muted">
      {children}
    </div>
  );
}
