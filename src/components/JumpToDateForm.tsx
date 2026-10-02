"use client";

import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { todayISO } from "@/lib/dates";

export function JumpToDateForm({ basePath }: { basePath: string }) {
  const router = useRouter();

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const date = new FormData(e.currentTarget).get("date");
        if (date) router.push(`${basePath}/${date}`);
      }}
    >
      <div className="min-w-0 flex-1 basis-full sm:min-w-[200px] sm:basis-auto">
        <label className="mb-1 block text-xs font-bold uppercase tracking-wide">Jump to a date</label>
        <Input type="date" name="date" defaultValue={todayISO()} required />
      </div>
      <Button type="submit" variant="ghost" className="w-full sm:w-auto">
        Go
      </Button>
    </form>
  );
}
