CREATE TYPE "public"."finance_account_type" AS ENUM('fd', 'mutual_fund', 'cash', 'bank', 'stocks', 'other');--> statement-breakpoint
CREATE TYPE "public"."finance_entry_type" AS ENUM('income', 'expense');--> statement-breakpoint
CREATE TYPE "public"."habit_reward_kind" AS ENUM('monthly_goal', 'streak');--> statement-breakpoint
CREATE TYPE "public"."milestone_status" AS ENUM('not_started', 'in_progress', 'done');--> statement-breakpoint
CREATE TYPE "public"."project_task_status" AS ENUM('not_started', 'in_progress', 'blocked', 'done', 'backlog');--> statement-breakpoint
CREATE TYPE "public"."release_status" AS ENUM('planned', 'in_progress', 'released');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TABLE "circle_invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"circle_id" integer NOT NULL,
	"email" varchar(320) NOT NULL,
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"invited_by" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "circle_invites_circle_id_email_unique" UNIQUE("circle_id","email")
);
--> statement-breakpoint
CREATE TABLE "circle_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"circle_id" integer NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "circle_members_circle_id_user_id_unique" UNIQUE("circle_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "circle_modules" (
	"id" serial PRIMARY KEY NOT NULL,
	"circle_id" integer NOT NULL,
	"module" varchar(30) NOT NULL,
	CONSTRAINT "circle_modules_circle_id_module_unique" UNIQUE("circle_id","module")
);
--> statement-breakpoint
CREATE TABLE "circles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"created_by" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"name" varchar(200) NOT NULL,
	"type" "finance_account_type" DEFAULT 'other' NOT NULL,
	"balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"notes" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"date" date NOT NULL,
	"type" "finance_entry_type" NOT NULL,
	"source" varchar(200) NOT NULL,
	"category" varchar(100) DEFAULT 'Other' NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"notes" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_shares" (
	"id" serial PRIMARY KEY NOT NULL,
	"circle_id" integer NOT NULL,
	"owner_id" varchar(64) NOT NULL,
	"level" varchar(20) DEFAULT 'summary' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "finance_shares_circle_id_owner_id_unique" UNIQUE("circle_id","owner_id")
);
--> statement-breakpoint
CREATE TABLE "finance_snapshot_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"snapshot_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"account_name" varchar(200) NOT NULL,
	"account_type" "finance_account_type" NOT NULL,
	"invested_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"current_value" numeric(14, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "finance_snapshot_items_snapshot_id_account_id_unique" UNIQUE("snapshot_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "finance_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"month" varchar(7) NOT NULL,
	"snapshot_date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "finance_snapshots_user_id_month_unique" UNIQUE("user_id","month")
);
--> statement-breakpoint
CREATE TABLE "finance_targets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"month" varchar(7) NOT NULL,
	"target_amount" numeric(14, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "finance_targets_user_id_month_unique" UNIQUE("user_id","month")
);
--> statement-breakpoint
CREATE TABLE "habit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"habit_id" integer NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "habit_logs_habit_id_date_unique" UNIQUE("habit_id","date")
);
--> statement-breakpoint
CREATE TABLE "habit_reactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"habit_id" integer NOT NULL,
	"circle_id" integer NOT NULL,
	"from_user_id" varchar(64) NOT NULL,
	"date" date NOT NULL,
	"emoji" varchar(8) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "habit_reactions_habit_id_circle_id_from_user_id_date_emoji_unique" UNIQUE("habit_id","circle_id","from_user_id","date","emoji")
);
--> statement-breakpoint
CREATE TABLE "habit_reward_claims" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"reward_id" integer NOT NULL,
	"month" varchar(24) NOT NULL,
	"claimed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "habit_reward_claims_reward_id_month_unique" UNIQUE("reward_id","month")
);
--> statement-breakpoint
CREATE TABLE "habit_rewards" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"habit_id" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"emoji" varchar(16),
	"kind" "habit_reward_kind" DEFAULT 'monthly_goal' NOT NULL,
	"streak_days" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "habit_shares" (
	"id" serial PRIMARY KEY NOT NULL,
	"habit_id" integer NOT NULL,
	"circle_id" integer NOT NULL,
	"owner_id" varchar(64) NOT NULL,
	"visibility" varchar(20) DEFAULT 'progress' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "habit_shares_habit_id_circle_id_unique" UNIQUE("habit_id","circle_id")
);
--> statement-breakpoint
CREATE TABLE "habits" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"title" varchar(200) NOT NULL,
	"roadmap_id" integer,
	"end_date" date,
	"target_days" integer,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"roadmap_id" integer NOT NULL,
	"title" varchar(300) NOT NULL,
	"notes" text,
	"target_date" date,
	"status" "milestone_status" DEFAULT 'not_started' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pomodoro_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"date" date NOT NULL,
	"minutes" integer NOT NULL,
	"task_id" integer,
	"task_title" varchar(300),
	"completed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pomodoro_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"focus_minutes" integer DEFAULT 25 NOT NULL,
	"short_break_minutes" integer DEFAULT 5 NOT NULL,
	"long_break_minutes" integer DEFAULT 15 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pomodoro_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"nickname" varchar(30) NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "project_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"project_id" integer NOT NULL,
	"release_id" integer,
	"title" varchar(300) NOT NULL,
	"branch_name" varchar(200),
	"priority" "task_priority" DEFAULT 'medium' NOT NULL,
	"status" "project_task_status" DEFAULT 'not_started' NOT NULL,
	"start_date" date,
	"due_date" date,
	"est_hours" numeric(6, 1),
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"roadmap_id" integer,
	"name" varchar(200) NOT NULL,
	"client" varchar(200),
	"status" varchar(50) DEFAULT 'Active' NOT NULL,
	"start_date" date,
	"deadline" date,
	"rate_value" varchar(100),
	"payment_status" varchar(100),
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "releases" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"project_id" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"start_date" date,
	"target_date" date,
	"status" "release_status" DEFAULT 'planned' NOT NULL,
	"notes" text,
	"release_note_url" varchar(500),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roadmaps" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"title" varchar(200) NOT NULL,
	"category" varchar(100) DEFAULT 'General' NOT NULL,
	"description" text,
	"color" varchar(20) DEFAULT 'orange' NOT NULL,
	"start_date" date,
	"end_date" date,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"title" varchar(300) NOT NULL,
	"date" date NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"roadmap_id" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_link_codes" (
	"code" varchar(32) PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"chat_id" varchar(32) NOT NULL,
	"telegram_username" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_links_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "telegram_links_chat_id_unique" UNIQUE("chat_id")
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"disabled_modules" text[] DEFAULT '{}' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_settings_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "circle_invites" ADD CONSTRAINT "circle_invites_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_members" ADD CONSTRAINT "circle_members_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_modules" ADD CONSTRAINT "circle_modules_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_shares" ADD CONSTRAINT "finance_shares_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_snapshot_items" ADD CONSTRAINT "finance_snapshot_items_snapshot_id_finance_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."finance_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_logs" ADD CONSTRAINT "habit_logs_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_reactions" ADD CONSTRAINT "habit_reactions_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_reactions" ADD CONSTRAINT "habit_reactions_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_reward_claims" ADD CONSTRAINT "habit_reward_claims_reward_id_habit_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."habit_rewards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_rewards" ADD CONSTRAINT "habit_rewards_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_shares" ADD CONSTRAINT "habit_shares_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_shares" ADD CONSTRAINT "habit_shares_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_roadmap_id_roadmaps_id_fk" FOREIGN KEY ("roadmap_id") REFERENCES "public"."roadmaps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_roadmap_id_roadmaps_id_fk" FOREIGN KEY ("roadmap_id") REFERENCES "public"."roadmaps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pomodoro_sessions" ADD CONSTRAINT "pomodoro_sessions_task_id_project_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."project_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_roadmap_id_roadmaps_id_fk" FOREIGN KEY ("roadmap_id") REFERENCES "public"."roadmaps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_roadmap_id_roadmaps_id_fk" FOREIGN KEY ("roadmap_id") REFERENCES "public"."roadmaps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "circle_one_head" ON "circle_members" USING btree ("circle_id") WHERE "circle_members"."role" = 'head';--> statement-breakpoint
CREATE UNIQUE INDEX "circle_one_co_head" ON "circle_members" USING btree ("circle_id") WHERE "circle_members"."role" = 'co_head';