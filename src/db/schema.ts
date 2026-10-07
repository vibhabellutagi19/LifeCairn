import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  boolean,
  date,
  numeric,
  timestamp,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";

export const milestoneStatus = pgEnum("milestone_status", [
  "not_started",
  "in_progress",
  "done",
]);

export const financeEntryType = pgEnum("finance_entry_type", [
  "income",
  "expense",
]);

export const financeAccountType = pgEnum("finance_account_type", [
  "fd",
  "mutual_fund",
  "cash",
  "bank",
  "stocks",
  "other",
]);

export const releaseStatus = pgEnum("release_status", [
  "planned",
  "in_progress",
  "released",
]);

export const projectTaskStatus = pgEnum("project_task_status", [
  "not_started",
  "in_progress",
  "blocked",
  "done",
  // Parked for later: hidden from every "what's next" view until brought back.
  "backlog",
]);

export const taskPriority = pgEnum("task_priority", ["low", "medium", "high"]);

export const emotionCategory = pgEnum("emotion_category", [
  "positive",
  "negative",
  "missing",
]);

// A roadmap is a generic goal track (Career, Money, Health, Relationship, or
// anything else the user adds). Each roadmap owns a list of milestones.
export const roadmaps = pgTable("roadmaps", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  category: varchar("category", { length: 100 }).notNull().default("General"),
  description: text("description"),
  color: varchar("color", { length: 20 }).notNull().default("orange"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// A milestone is one checkpoint/phase within a roadmap (e.g. "Week 1 (Oct 1-15)").
export const milestones = pgTable("milestones", {
  id: serial("id").primaryKey(),
  roadmapId: integer("roadmap_id")
    .notNull()
    .references(() => roadmaps.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 300 }).notNull(),
  notes: text("notes"),
  targetDate: date("target_date"),
  status: milestoneStatus("status").notNull().default("not_started"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Day-wise tasks, optionally linked back to a roadmap for progress rollups.
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 300 }).notNull(),
  date: date("date").notNull(),
  completed: boolean("completed").notNull().default(false),
  roadmapId: integer("roadmap_id").references(() => roadmaps.id, {
    onDelete: "set null",
  }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Affirmations library, grouped by free-text category and an optional
// subcategory (e.g. Money -> Maintenance / Goal / Action / Extra abundance).
export const affirmations = pgTable("affirmations", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  category: varchar("category", { length: 100 }).notNull().default("General"),
  subcategory: varchar("subcategory", { length: 100 }),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// A permanent celebration record. Text and classification are copied so the
// history survives later edits or deletion of the original affirmation.
export const affirmationManifestations = pgTable(
  "affirmation_manifestations",
  {
    id: serial("id").primaryKey(),
    affirmationId: integer("affirmation_id").references(() => affirmations.id, {
      onDelete: "set null",
    }),
    affirmationText: text("affirmation_text").notNull(),
    category: varchar("category", { length: 100 }).notNull(),
    subcategory: varchar("subcategory", { length: 100 }),
    manifestedOn: date("manifested_on").notNull(),
    reflection: text("reflection"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [unique().on(table.affirmationId)]
);

export const affirmationSlot = pgEnum("affirmation_slot", [
  "morning",
  "afternoon",
  "evening",
]);

// One row per session (morning/afternoon/evening) a day the affirmation
// practice happened. A day counts as fully done once all three are logged.
export const affirmationCheckins = pgTable(
  "affirmation_checkins",
  {
    id: serial("id").primaryKey(),
    date: date("date").notNull(),
    slot: affirmationSlot("slot").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [unique().on(table.date, table.slot)]
);

// One journal entry per day.
export const journalEntries = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  date: date("date").notNull().unique(),
  content: text("content").notNull().default(""),
  gratitude: text("gratitude"),
  mood: varchar("mood", { length: 20 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// One quick emotional check-in per hour. Keeping this separate from the
// journal's daily mood preserves the way feelings change throughout a day.
export const emotionalCheckins = pgTable(
  "emotional_checkins",
  {
    id: serial("id").primaryKey(),
    date: date("date").notNull(),
    hour: integer("hour").notNull(),
    emotion: varchar("emotion", { length: 30 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [unique().on(table.date, table.hour)]
);

// A reusable daily window controls which hourly check-ins make up the day.
// This app currently has one local profile, keyed as "default".
export const emotionalTrackingSettings = pgTable("emotional_tracking_settings", {
  id: serial("id").primaryKey(),
  profileKey: varchar("profile_key", { length: 50 }).notNull().default("default").unique(),
  startHour: integer("start_hour").notNull().default(7),
  endHour: integer("end_hour").notNull().default(22),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Personal additions to the built-in emotion palette.
export const customEmotions = pgTable("custom_emotions", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 60 }).notNull().unique(),
  emoji: varchar("emoji", { length: 20 }).notNull().default("◌"),
  category: emotionCategory("category").notNull(),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Point-in-time savings (FD, mutual fund, emergency fund, etc.) with running balance.
export const financeAccounts = pgTable("finance_accounts", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  type: financeAccountType("type").notNull().default("other"),
  balance: numeric("balance", { precision: 14, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// A dated, month-level valuation. Snapshot items copy the account name/type so
// historical reports remain intact even if a live account is later renamed or
// removed.
export const financeSnapshots = pgTable("finance_snapshots", {
  id: serial("id").primaryKey(),
  month: varchar("month", { length: 7 }).notNull().unique(), // "2026-09"
  snapshotDate: date("snapshot_date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const financeSnapshotItems = pgTable(
  "finance_snapshot_items",
  {
    id: serial("id").primaryKey(),
    snapshotId: integer("snapshot_id")
      .notNull()
      .references(() => financeSnapshots.id, { onDelete: "cascade" }),
    accountId: integer("account_id").notNull(),
    accountName: varchar("account_name", { length: 200 }).notNull(),
    accountType: financeAccountType("account_type").notNull(),
    investedAmount: numeric("invested_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    currentValue: numeric("current_value", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    currency: varchar("currency", { length: 3 }).notNull().default("INR"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [unique().on(table.snapshotId, table.accountId)]
);

// Income / expense log entries for monthly cash-flow tracking.
export const financeEntries = pgTable("finance_entries", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  type: financeEntryType("type").notNull(),
  source: varchar("source", { length: 200 }).notNull(),
  category: varchar("category", { length: 100 }).notNull().default("Other"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Monthly passive/total income target vs what actually lands, per the money roadmap.
export const financeTargets = pgTable("finance_targets", {
  id: serial("id").primaryKey(),
  month: varchar("month", { length: 7 }).notNull().unique(), // "2026-10"
  targetAmount: numeric("target_amount", { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// A client/freelance project. Optionally attached to a roadmap, which acts as
// its "Goal" (e.g. the Career roadmap owns both the gym app and homestay projects).
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  roadmapId: integer("roadmap_id").references(() => roadmaps.id, {
    onDelete: "set null",
  }),
  name: varchar("name", { length: 200 }).notNull(),
  client: varchar("client", { length: 200 }),
  status: varchar("status", { length: 50 }).notNull().default("Active"),
  startDate: date("start_date"),
  deadline: date("deadline"),
  rateValue: varchar("rate_value", { length: 100 }),
  paymentStatus: varchar("payment_status", { length: 100 }),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// A release/milestone within a project (e.g. v1.0, Beta, Launch). Tasks link to one.
export const releases = pgTable("releases", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }).notNull(),
  startDate: date("start_date"),
  targetDate: date("target_date"),
  status: releaseStatus("status").notNull().default("planned"),
  notes: text("notes"),
  releaseNoteUrl: varchar("release_note_url", { length: 500 }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// A work item within a project, optionally tied to a specific release.
export const projectTasks = pgTable("project_tasks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  releaseId: integer("release_id").references(() => releases.id, {
    onDelete: "set null",
  }),
  title: varchar("title", { length: 300 }).notNull(),
  // Lets a task be addressed by its git feature-branch name in the URL
  // (/projects/:id/tasks/:branchName) instead of the raw numeric id.
  branchName: varchar("branch_name", { length: 200 }),
  priority: taskPriority("priority").notNull().default("medium"),
  status: projectTaskStatus("status").notNull().default("not_started"),
  startDate: date("start_date"),
  dueDate: date("due_date"),
  estHours: numeric("est_hours", { precision: 6, scale: 1 }),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// A habit to check off daily. Optionally tagged to a roadmap (e.g. "Walk 30
// min" -> Health), same pattern as day-wise tasks.
export const habits = pgTable("habits", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  roadmapId: integer("roadmap_id").references(() => roadmaps.id, {
    onDelete: "set null",
  }),
  // Genuinely finite habits (e.g. tied to a date range) can set an end date
  // so they drop off the active list on their own. Separate from `active`,
  // which is a manual pause/resume toggle for habits you might pick back up.
  endDate: date("end_date"),
  // Optional monthly goal: how many days a month this habit should be done
  // (e.g. walk on 20 days). Progress is derived from habit_logs each month.
  targetDays: integer("target_days"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// One row per day a habit was completed. Streak and lifetime score are
// derived from these, never stored, so they're always consistent.
export const habitLogs = pgTable(
  "habit_logs",
  {
    id: serial("id").primaryKey(),
    habitId: integer("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [unique().on(table.habitId, table.date)]
);

// One finished focus session from the Pomodoro timer. The task title is
// copied so history still reads well after a task is renamed or deleted.
export const pomodoroSessions = pgTable("pomodoro_sessions", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  minutes: integer("minutes").notNull(),
  taskId: integer("task_id").references(() => projectTasks.id, { onDelete: "set null" }),
  taskTitle: varchar("task_title", { length: 300 }),
  completedAt: timestamp("completed_at").notNull().defaultNow(),
});

// Timer durations, same single "default" profile as emotional tracking.
export const pomodoroSettings = pgTable("pomodoro_settings", {
  id: serial("id").primaryKey(),
  profileKey: varchar("profile_key", { length: 50 }).notNull().default("default").unique(),
  focusMinutes: integer("focus_minutes").notNull().default(25),
  shortBreakMinutes: integer("short_break_minutes").notNull().default(5),
  longBreakMinutes: integer("long_break_minutes").notNull().default(15),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// One finished ho'oponopono session: how many times the four phrases were
// said, the goal set (null = open-ended / conversational), an optional
// intention (who or what it was for) and an optional reflection afterwards.
export const hooponoponoRounds = pgTable("hooponopono_rounds", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  repetitions: integer("repetitions").notNull().default(108),
  target: integer("target"),
  intention: varchar("intention", { length: 200 }),
  note: text("note"),
  completedAt: timestamp("completed_at").notNull().defaultNow(),
});

export const habitRewardKind = pgEnum("habit_reward_kind", ["monthly_goal", "streak"]);

// Self-chosen rewards attached to a habit. A "monthly_goal" reward unlocks in
// any month the habit reaches its monthly goal (habits.target_days); a
// "streak" reward unlocks whenever a run of check-ins reaches streak_days.
export const habitRewards = pgTable("habit_rewards", {
  id: serial("id").primaryKey(),
  habitId: integer("habit_id")
    .notNull()
    .references(() => habits.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  emoji: varchar("emoji", { length: 16 }),
  kind: habitRewardKind("kind").notNull().default("monthly_goal"),
  streakDays: integer("streak_days"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// A reward taken for one period, at most once per period: "yyyy-MM" for a
// monthly goal, "streak:yyyy-MM-dd" (the streak's first day) for a streak.
// The DB column is still called "month" from before streak rewards existed.
export const habitRewardClaims = pgTable(
  "habit_reward_claims",
  {
    id: serial("id").primaryKey(),
    rewardId: integer("reward_id")
      .notNull()
      .references(() => habitRewards.id, { onDelete: "cascade" }),
    period: varchar("month", { length: 24 }).notNull(),
    claimedAt: timestamp("claimed_at").notNull().defaultNow(),
  },
  (table) => [unique().on(table.rewardId, table.period)]
);
