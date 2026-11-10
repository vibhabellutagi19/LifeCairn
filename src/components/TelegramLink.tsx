"use client";

import { useState, useTransition } from "react";
import { Button, Card } from "@/components/ui";
import { createTelegramLinkCode, unlinkTelegram } from "@/lib/actions/telegram";

const COMMANDS: [string, string][] = [
  ["/e 12.50 Lidl food #trip", "log an expense"],
  ["/i 3200 salary", "log income"],
  ["/h", "tick today's habits"],
  ["/t", "update a project task"],
  ["/today", "today at a glance"],
];

export function TelegramLink({
  linkedAs,
  configured,
}: {
  /** null when not linked; "" when linked without a Telegram username. */
  linkedAs: string | null;
  configured: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [pending, setPending] = useState<{ code: string; url: string | null } | null>(null);

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Telegram</h2>
          <p className="text-sm font-semibold text-muted">
            Log expenses, income, habits and task updates from a chat.
          </p>
        </div>
        <span
          className={`brut-border shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase ${
            linkedAs !== null ? "bg-green text-white" : "bg-background text-muted"
          }`}
        >
          {linkedAs !== null ? "Linked" : "Not linked"}
        </span>
      </div>

      {!configured ? (
        <p className="text-sm font-semibold text-muted">
          The bot isn&apos;t set up on this server yet (TELEGRAM_BOT_TOKEN / TELEGRAM_BOT_USERNAME).
        </p>
      ) : linkedAs !== null ? (
        <div className="space-y-3">
          <p className="text-sm font-semibold">
            Connected{linkedAs ? <> as <b>@{linkedAs}</b></> : null}. Message the bot to log things.
          </p>
          <ul className="space-y-1 rounded-md bg-background p-3 text-xs">
            {COMMANDS.map(([cmd, what]) => (
              <li key={cmd}>
                <code className="font-bold">{cmd}</code> <span className="text-muted">— {what}</span>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => {
              if (!confirm("Disconnect Telegram? The bot will stop logging for you.")) return;
              startTransition(() => unlinkTelegram());
            }}
          >
            Unlink
          </Button>
        </div>
      ) : pending ? (
        <div className="space-y-3">
          {pending.url ? (
            <a
              href={pending.url}
              target="_blank"
              rel="noreferrer"
              className="brut-border brut-shadow-sm block rounded-md bg-blue px-4 py-3 text-center font-bold text-white hover:opacity-90"
            >
              Open Telegram and tap Start →
            </a>
          ) : null}
          <p className="text-sm font-semibold text-muted">
            Or send the bot this message: <code className="font-bold text-ink">/start {pending.code}</code>
          </p>
          <p className="text-xs font-semibold text-muted">
            The code works once and expires in 15 minutes. Refresh this page after linking.
          </p>
        </div>
      ) : (
        <Button
          type="button"
          variant="primary"
          disabled={isPending}
          onClick={() => startTransition(async () => setPending(await createTelegramLinkCode()))}
        >
          {isPending ? "Creating link..." : "Link Telegram"}
        </Button>
      )}
    </Card>
  );
}
