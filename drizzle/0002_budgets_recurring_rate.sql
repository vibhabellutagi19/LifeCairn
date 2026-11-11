CREATE TABLE "finance_budgets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"category" varchar(100) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "finance_budgets_user_id_category_unique" UNIQUE("user_id","category")
);
--> statement-breakpoint
CREATE TABLE "finance_recurring" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"type" "finance_entry_type" NOT NULL,
	"source" varchar(200) NOT NULL,
	"category" varchar(100) DEFAULT 'Other' NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"day_of_month" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "finance_entries" ADD COLUMN "recurring_id" integer;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "eur_to_inr" numeric(10, 4);