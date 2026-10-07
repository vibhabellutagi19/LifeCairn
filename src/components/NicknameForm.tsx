"use client";

import { useActionState } from "react";
import { clsx } from "clsx";
import { Button, Card, Input } from "@/components/ui";
import { saveNickname, type NicknameState } from "@/lib/actions/profile";

/**
 * Nickname form with save feedback. As the dashboard "prompt" it only shows
 * while no nickname is set, but stays on screen after saving so the
 * confirmation message is seen (the server re-render would otherwise remove it).
 */
export function NicknameForm({
  nickname,
  variant,
}: {
  nickname: string | null;
  variant: "prompt" | "profile";
}) {
  const [state, formAction, pending] = useActionState<NicknameState, FormData>(saveNickname, null);

  if (variant === "prompt" && nickname && !state?.ok) return null;

  const form = (
    <form action={formAction} className={variant === "prompt" ? "flex flex-col gap-3 sm:flex-row sm:items-end" : "space-y-3"}>
      <div className="flex-1">
        <label htmlFor={`nickname-${variant}`} className="mb-1 block text-xs font-bold uppercase tracking-wide">
          {variant === "prompt" ? "😺 What should the cat call you?" : "Nickname"}
        </label>
        <Input
          id={`nickname-${variant}`}
          name="nickname"
          defaultValue={nickname ?? ""}
          maxLength={30}
          placeholder={variant === "prompt" ? "Your nickname" : "What should the cat call you?"}
          required
        />
        {variant === "profile" ? (
          <p className="mt-1 text-xs font-semibold text-muted">Only you see this, and it&apos;s only used to talk to you.</p>
        ) : null}
      </div>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Saving…" : variant === "prompt" ? "Save nickname" : "Save"}
      </Button>
      {state ? (
        <p role="status" className={clsx("text-sm font-bold", state.ok ? "text-green" : "text-pink", variant === "prompt" && "sm:basis-full")}>
          {state.message}
        </p>
      ) : null}
    </form>
  );

  return variant === "prompt" ? <Card className="mb-6 bg-yellow/40">{form}</Card> : <Card>{form}</Card>;
}
