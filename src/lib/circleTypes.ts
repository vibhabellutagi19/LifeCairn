import type { ModuleKey } from "@/lib/modules";

// Safe to import from client components.
export type CircleRole = "head" | "co_head" | "member";

export const ROLE_LABEL: Record<CircleRole, string> = {
  head: "Head",
  co_head: "Co-head",
  member: "Member",
};

/** Modules a circle can share. Journal and affirmations stay private. */
export const SHAREABLE_MODULES: ModuleKey[] = ["habits", "finance", "projects"];

export function isCircleRole(value: string): value is CircleRole {
  return value === "head" || value === "co_head" || value === "member";
}
