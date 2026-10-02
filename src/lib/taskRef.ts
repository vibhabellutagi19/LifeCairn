/** URL segment for a task: its branch name when set, else its numeric id. */
export function taskRefFor(task: { id: number; branchName: string | null }) {
  return task.branchName || String(task.id);
}

/** Resolves a /tasks/:ref URL segment back to a lookup condition. */
export function parseTaskRef(ref: string): { byId: number } | { byBranch: string } {
  return /^\d+$/.test(ref) ? { byId: Number(ref) } : { byBranch: ref };
}
