export type ProjectTaskStatus = "not_started" | "in_progress" | "blocked" | "done" | "backlog";

/**
 * Backlog = parked for later. Like done, backlog tasks are not "open work": they stay out of
 * the dashboard plan, Focus Next, the Pomodoro list, overdue warnings and Review counts.
 */
export function isOpenTask(status: ProjectTaskStatus) {
  return status !== "done" && status !== "backlog";
}
