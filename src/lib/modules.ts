// The switchable parts of the app. Dashboard, daily tasks and Profile are
// always on. Safe to import from client components (no server-only deps).
export const MODULES = [
  { key: "roadmaps", label: "Roadmaps", emoji: "🗺️", href: "/roadmaps", description: "Goals and their milestones." },
  { key: "projects", label: "Projects", emoji: "🧩", href: "/projects", description: "Projects, releases and project tasks." },
  { key: "habits", label: "Habit Tracker", emoji: "🔥", href: "/habits", description: "Daily habits, streaks and the reward shop." },
  { key: "pomodoro", label: "Pomodoro", emoji: "🍅", href: "/pomodoro", description: "Focus timer and session history." },
  { key: "finance", label: "Finance", emoji: "💰", href: "/finance", description: "Accounts, income and expenses." },
  { key: "review", label: "Review", emoji: "📊", href: "/review", description: "Weekly and monthly look back." },
] as const;

export type ModuleKey = (typeof MODULES)[number]["key"] | "manifestation" | "journal";

export function isModuleKey(value: string): value is ModuleKey {
  return MODULES.some((m) => m.key === value);
}
