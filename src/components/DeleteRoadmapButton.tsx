"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function DeleteRoadmapButton({
  id,
  action,
}: {
  id: number;
  action: (id: number) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="pink"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Delete this roadmap and all its milestones?")) return;
        startTransition(async () => {
          await action(id);
          router.push("/roadmaps");
        });
      }}
    >
      Delete
    </Button>
  );
}
