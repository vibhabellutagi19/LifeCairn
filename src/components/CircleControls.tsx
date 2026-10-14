"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Select } from "@/components/ui";
import {
  acceptInvite,
  declineInvite,
  deleteCircle,
  inviteToCircle,
  leaveCircle,
  removeMember,
  revokeInvite,
  setMemberRole,
} from "@/lib/actions/circles";
import type { CircleRole } from "@/lib/circleTypes";

export function InviteResponseButtons({ inviteId }: { inviteId: number }) {
  const [isPending, startTransition] = useTransition();
  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="green"
        size="sm"
        disabled={isPending}
        onClick={() => startTransition(() => acceptInvite(inviteId))}
      >
        Accept
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={() => startTransition(() => declineInvite(inviteId))}
      >
        Decline
      </Button>
    </div>
  );
}

export function InviteForm({ circleId, canInviteCoHead }: { circleId: number; canInviteCoHead: boolean }) {
  const [state, formAction, isPending] = useActionState(inviteToCircle.bind(null, circleId), null);
  return (
    <form action={formAction} className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input type="email" name="email" placeholder="their@email.com" required key={state?.ok ? "sent" : "form"} />
        {canInviteCoHead ? (
          <Select name="role" defaultValue="member" className="sm:w-40">
            <option value="member">Member</option>
            <option value="co_head">Co-head</option>
          </Select>
        ) : null}
        <Button type="submit" variant="primary" disabled={isPending}>
          {isPending ? "Inviting..." : "Invite"}
        </Button>
      </div>
      {state ? (
        <p className={`text-sm font-bold ${state.ok ? "text-green" : "text-pink"}`}>{state.message}</p>
      ) : null}
    </form>
  );
}

export function RevokeInviteButton({ inviteId }: { inviteId: number }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => revokeInvite(inviteId))}
      className="text-xs font-bold uppercase text-muted underline underline-offset-2 hover:text-pink"
    >
      Cancel invite
    </button>
  );
}

export function MemberActions({
  circleId,
  targetUserId,
  targetRole,
  myRole,
  coHeadTaken,
}: {
  circleId: number;
  targetUserId: string;
  targetRole: CircleRole;
  myRole: CircleRole;
  coHeadTaken: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const canSetRole = myRole === "head" && targetRole !== "head";
  const canRemove =
    targetRole !== "head" && (myRole === "head" || (myRole === "co_head" && targetRole === "member"));
  if (!canSetRole && !canRemove) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {canSetRole && targetRole === "member" && !coHeadTaken ? (
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => startTransition(() => setMemberRole(circleId, targetUserId, "co_head"))}
        >
          Make co-head
        </Button>
      ) : null}
      {canSetRole && targetRole === "co_head" ? (
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => startTransition(() => setMemberRole(circleId, targetUserId, "member"))}
        >
          Make member
        </Button>
      ) : null}
      {canRemove ? (
        <Button
          type="button"
          variant="pink"
          size="sm"
          disabled={isPending}
          onClick={() => {
            if (!confirm("Remove this person from the circle? Their own data is not deleted.")) return;
            startTransition(() => removeMember(circleId, targetUserId));
          }}
        >
          Remove
        </Button>
      ) : null}
    </div>
  );
}

export function LeaveOrDeleteButton({ circleId, role }: { circleId: number; role: CircleRole }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isHead = role === "head";
  return (
    <Button
      type="button"
      variant="pink"
      disabled={isPending}
      onClick={() => {
        const message = isHead
          ? "Delete this circle for everyone? Members keep their own data, but nothing stays shared."
          : "Leave this circle? Your own data is not deleted.";
        if (!confirm(message)) return;
        startTransition(async () => {
          await (isHead ? deleteCircle(circleId) : leaveCircle(circleId));
          router.push("/circles");
        });
      }}
    >
      {isHead ? "Delete circle" : "Leave circle"}
    </Button>
  );
}
