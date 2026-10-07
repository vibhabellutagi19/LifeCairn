import { taskRefFor } from "@/lib/taskRef";

export type CatNudge = {
  emoji: string;
  text: string;
  href?: string;
  cta?: string;
};

type NudgeInput = {
  today: string;
  /** The user's chosen nickname, if they set one. */
  nickname?: string | null;
  focusTask?: {
    id: number;
    title: string;
    branchName: string | null;
    status: string;
    projectId: number;
    projectName: string;
  };
  pendingHabits: { title: string; currentStreak: number }[];
  plannedCount: number;
  remainingCount: number;
  hasAffirmations: boolean;
  affirmationCheckinsLeft: number;
  journalWritten: boolean;
};

/** The cat's pep talks, built from whatever is still open today. */
export function buildCatNudges(input: NudgeInput): CatNudge[] {
  const nudges: CatNudge[] = [];
  const { focusTask } = input;
  // Used sparingly (greeting and all-done lines) so it doesn't feel repetitive.
  const name = input.nickname?.trim();

  if (focusTask) {
    nudges.push({
      emoji: "🧩",
      text:
        focusTask.status === "in_progress"
          ? `"${focusTask.title}" in ${focusTask.projectName} is already half-pounced. Finish what you started?`
          : `"${focusTask.title}" in ${focusTask.projectName} is next up. Ten focused minutes is all I ask.`,
      href: `/projects/${focusTask.projectId}/tasks/${taskRefFor(focusTask)}`,
      cta: "Open the task",
    });
  }

  for (const habit of input.pendingHabits.slice(0, 3)) {
    nudges.push({
      emoji: "🌱",
      text:
        habit.currentStreak > 0
          ? `"${habit.title}" isn't ticked yet. Don't let that ${habit.currentStreak}-day streak slip away!`
          : `"${habit.title}" is waiting. Small and easy, then it's done.`,
      href: "/habits",
      cta: "Go to habits",
    });
  }

  if (input.plannedCount === 0) {
    nudges.push({
      emoji: "☀️",
      text: `Nothing planned today${name ? `, ${name}` : ""}. Add just one meaningful thing, I'll supervise.`,
      href: "/",
      cta: "Plan the day",
    });
  } else if (input.remainingCount > 0) {
    nudges.push({
      emoji: "✅",
      text: `${input.remainingCount} ${input.remainingCount === 1 ? "task is" : "tasks are"} still open today. Knock one out and I'll purr.`,
    });
  }

  if (input.hasAffirmations && input.affirmationCheckinsLeft > 0) {
    nudges.push({
      emoji: "✨",
      text: `${input.affirmationCheckinsLeft} affirmation check-in${input.affirmationCheckinsLeft === 1 ? "" : "s"} left. Say it like you mean it.`,
      href: "/affirmations",
      cta: "Check in",
    });
  }

  if (!input.journalWritten) {
    nudges.push({
      emoji: "✎",
      text: `${name ? `${name}, your` : "Your"} journal is feeling lonely. Three honest lines is plenty.`,
      href: `/journal/${input.today}`,
      cta: "Open journal",
    });
  }

  if (nudges.length === 0) {
    nudges.push({
      emoji: "🏆",
      text: `Everything's done${name ? `, ${name}` : ""}! I'm so proud of you. Go stretch, drink water, accept head scratches.`,
    });
  }

  return nudges;
}
