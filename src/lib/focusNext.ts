import type { ProjectTaskStatus } from "@/lib/taskStatus";

type FocusTask = {
  id: number;
  priority: "low" | "medium" | "high";
  status: ProjectTaskStatus;
  dueDate: string | null;
};

const PRIORITY_WEIGHT: Record<FocusTask["priority"], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Ranks actionable tasks for "what should I work on next": continue anything
 * already in progress, then by priority, then by nearest due date. Blocked
 * and done tasks aren't "next" actions, so callers should exclude them first.
 */
export function rankFocusTasks<T extends FocusTask>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    const inProgressDiff = Number(b.status === "in_progress") - Number(a.status === "in_progress");
    if (inProgressDiff !== 0) return inProgressDiff;

    const priorityDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (priorityDiff !== 0) return priorityDiff;

    if (a.dueDate && b.dueDate) return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;

    return a.id - b.id;
  });
}

/**
 * A project task counts as active if the selected date falls inside its
 * start/due window: within [startDate, dueDate] when both are set, from
 * startDate onward when open-ended, or from dueDate onward (i.e. due or
 * overdue) when only a due date was set. Tasks with neither date don't
 * show up here — they're still visible on the project page.
 */
export function isActiveOnDate(
  task: { startDate: string | null; dueDate: string | null; status: FocusTask["status"] },
  date: string
) {
  const { startDate, dueDate, status } = task;
  if (status === "backlog") return false;

  if (startDate && dueDate) return startDate <= date && date <= dueDate;

  // Open-ended tasks (only one date set) surface every day from that date
  // onward until they're marked done — once done, only their exact date
  // still counts, so a finished task doesn't linger forever.
  if (startDate) return status === "done" ? startDate === date : startDate <= date;
  if (dueDate) return status === "done" ? dueDate === date : dueDate <= date;
  return false;
}
