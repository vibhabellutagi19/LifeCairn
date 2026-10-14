"use client";

import { useOptimistic, useTransition } from "react";
import { clsx } from "clsx";
import { Card } from "@/components/ui";
import { setModuleEnabled } from "@/lib/actions/settings";
import { MODULES, type ModuleKey } from "@/lib/modules";

export function ModuleToggles({ disabledModules }: { disabledModules: ModuleKey[] }) {
  const [isPending, startTransition] = useTransition();
  const [disabled, setOptimistic] = useOptimistic(
    disabledModules,
    (current, change: { key: ModuleKey; enabled: boolean }) =>
      change.enabled ? current.filter((k) => k !== change.key) : [...current, change.key]
  );

  return (
    <Card>
      <h2 className="font-display text-xl font-bold">Modules</h2>
      <p className="mb-4 mt-1 text-sm font-semibold text-muted">
        Switch off what you don&rsquo;t use. It disappears from the sidebar and dashboard; your data is kept.
      </p>
      <ul className="space-y-2">
        {MODULES.map((m) => {
          const enabled = !disabled.includes(m.key);
          return (
            <li key={m.key} className="brut-border flex items-center justify-between gap-3 rounded-md bg-surface p-3">
              <div className="min-w-0">
                <p className="font-bold">
                  <span aria-hidden className="mr-2">{m.emoji}</span>
                  {m.label}
                </p>
                <p className="text-xs font-semibold text-muted">{m.description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label={`${m.label} ${enabled ? "on" : "off"}`}
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    setOptimistic({ key: m.key, enabled: !enabled });
                    await setModuleEnabled(m.key, !enabled);
                  })
                }
                className={clsx(
                  "brut-border relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-60",
                  enabled ? "bg-green" : "bg-background"
                )}
              >
                <span
                  aria-hidden
                  className={clsx(
                    "brut-border absolute top-0.5 h-6 w-6 rounded-full bg-surface transition-all",
                    enabled ? "left-[1.625rem]" : "left-0.5"
                  )}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
