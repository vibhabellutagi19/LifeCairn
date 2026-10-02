"use client";

import { useState, useTransition } from "react";
import { clsx } from "clsx";
import { updateProjectTaskDetails } from "@/lib/actions/projects";
import { Button, Card, Input, Textarea } from "@/components/ui";

export function TaskDetailsForm({
  id,
  projectId,
  title,
  branchName,
  notes,
  estHours,
}: {
  id: number;
  projectId: number;
  title: string;
  branchName: string | null;
  notes: string | null;
  estHours: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [titleVal, setTitleVal] = useState(title);
  const [branchVal, setBranchVal] = useState(branchName ?? "");
  const [notesVal, setNotesVal] = useState(notes ?? "");
  const [estHoursVal, setEstHoursVal] = useState(estHours ?? "");
  const [saved, setSaved] = useState(false);

  return (
    <Card className={clsx("transition-colors duration-500", saved && "bg-green/15")}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">Details</h2>
        {saved ? (
          <span className="brut-border rounded-full bg-green px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
            ✓ Saved
          </span>
        ) : null}
      </div>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wide">Title</label>
          <Input value={titleVal} onChange={(e) => setTitleVal(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wide">
            Feature branch name <span className="normal-case text-muted">(optional — used in the URL)</span>
          </label>
          <Input
            value={branchVal}
            onChange={(e) => setBranchVal(e.target.value)}
            placeholder="e.g. feature/discounts-payments"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wide">Est. hours</label>
          <Input value={estHoursVal} onChange={(e) => setEstHoursVal(e.target.value)} inputMode="decimal" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wide">Notes / next action</label>
          <Textarea value={notesVal} onChange={(e) => setNotesVal(e.target.value)} rows={4} />
        </div>
        <Button
          type="button"
          variant={saved ? "green" : "primary"}
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await updateProjectTaskDetails(id, projectId, {
                title: titleVal,
                branchName: branchVal || null,
                notes: notesVal || null,
                estHours: estHoursVal || null,
              });
              setSaved(true);
              setTimeout(() => setSaved(false), 2000);
            })
          }
        >
          {isPending ? "Saving..." : saved ? "✓ Saved" : "Save"}
        </Button>
      </div>
    </Card>
  );
}
