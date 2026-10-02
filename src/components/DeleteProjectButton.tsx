"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { deleteProject } from "@/lib/actions/projects";

export function DeleteProjectButton({ id }: { id: number }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="pink"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Delete this project and all its releases and tasks?")) return;
        startTransition(async () => {
          await deleteProject(id);
          router.push("/projects");
        });
      }}
    >
      Delete
    </Button>
  );
}
