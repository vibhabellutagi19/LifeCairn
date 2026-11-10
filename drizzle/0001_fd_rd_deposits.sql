-- IF NOT EXISTS: some databases got these columns by hand before migrations existed.
ALTER TYPE "public"."finance_account_type" ADD VALUE IF NOT EXISTS 'rd' BEFORE 'mutual_fund';--> statement-breakpoint
ALTER TABLE "finance_accounts" ADD COLUMN IF NOT EXISTS "deposit_amount" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "finance_accounts" ADD COLUMN IF NOT EXISTS "interest_rate" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "finance_accounts" ADD COLUMN IF NOT EXISTS "deposit_start" date;--> statement-breakpoint
ALTER TABLE "finance_accounts" ADD COLUMN IF NOT EXISTS "deposit_maturity" date;--> statement-breakpoint
ALTER TABLE "finance_accounts" ADD COLUMN IF NOT EXISTS "interest_payout" varchar(10);
