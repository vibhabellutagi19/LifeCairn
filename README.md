# LifeCairn

A local-first tracker for your Oct–Dec 2026 roadmap: Career, Money, Health, and Relationship. Neo-brutalist, warm & bold — built with Next.js, Tailwind, Drizzle ORM, and Postgres.

## What's inside

- **Dashboard** — today's tasks, journal status, affirmation check-in, roadmap progress, finance snapshot.
- **Roadmaps** — generic: add any roadmap (Career/Money/Health/Relationship are pre-seeded from your plan), each with milestones you can cycle through Not Started → In Progress → Done.
- **Projects** — freelance/client work as Goal → Project → Release → Task: projects optionally link to a roadmap as their "Goal" (e.g. Move & NimmaVasti → Career). A project's overview page (`/projects/:id`) shows stat tiles (releases, tasks, completed, due this week/month) plus previews linking to dedicated pages: `/projects/:id/releases` (list) and `/projects/:id/releases/:releaseId` (detail — editable start/target date, notes, release URL, plus every task tagged to it), and `/projects/:id/tasks` (list, grouped by status with Done/Blocked collapsed) and `/projects/:id/tasks/:ref` (detail — editable title, priority, status, release, start/due dates, est. hours, notes). A task's URL uses its feature branch name when you set one (e.g. `/projects/1/tasks/feature/discounts-payments`), falling back to its numeric id otherwise. A "Focus Next" view auto-ranks open tasks across all projects (in-progress first, then priority, then nearest due date) — shown on the Projects page and the Dashboard. A project task also surfaces on the Dashboard's Today's Tasks card whenever today falls inside its start/due window.
- **Daily Tasks** — plan tasks per day, optionally tag them to a roadmap, navigate day by day.
- **Habit Tracker** — a monthly calendar grid: habits as rows, days as columns. Click any past day to backfill a missed check-in (future days are locked); today's column is highlighted. Streak (consecutive days, with a same-day grace period) and score (lifetime completions, never decreases) are derived live from your check-in history, never stored. Click a habit's title to rename it or change its target in place without losing its streak — for a habit that evolves (e.g. 30min walk → 45min walk), edit it rather than starting a new one. Habits can also get an optional end date for ones that genuinely finish (vs. the pause/resume toggle, for ones you might pick back up). A compact "Habits" card on the Dashboard lets you check today's habits without leaving the home page.
- **Affirmations** — a categorized library (pre-seeded with your money/health affirmations) plus a 3x-daily check-in (morning/afternoon/evening), with the same streak/score mechanics as the Habit Tracker.
- **Journal** — one entry per day: free text, gratitude, mood.
- **Finance** — accounts (FDs, mutual funds, etc.), an income/expense log, net worth, and a monthly income target with progress.
- **Review** — week/month rollups: task completion %, journal streak, affirmation streak, net cash flow, milestones due in the period.

## First-time setup

Requires Node.js and Docker Desktop (for local Postgres).

```bash
npm install
npm run docker:up      # starts Postgres in Docker (localhost:5432)
npm run db:push        # creates the schema
npm run db:seed        # loads your Career/Money/Health/Relationship roadmap + affirmations + accounts (skips if data already exists)
npm run db:seed-projects  # imports Move & NimmaVasti (projects/releases/tasks) from your spreadsheet (skips if data already exists)
npm run dev
```

Then open http://localhost:6001.

## Day to day

```bash
npm run docker:up   # if the Postgres container isn't running
npm run dev
```

Stop Postgres when you're done: `npm run docker:down` (your data persists in a Docker volume between restarts).

## Useful scripts

- `npm run db:studio` — opens Drizzle Studio, a GUI for browsing/editing the database directly.
- `npm run db:push` — re-syncs the database schema after you edit `src/db/schema.ts`.

## Deploying to EC2

Follow [the deployment guide](DEPLOY.md). Run [deploy/push-ecr.sh](deploy/push-ecr.sh) on your computer to build and push the app and database tools images. EC2 pulls those images and runs them with PostgreSQL and Caddy. Configure Clerk authentication using the guide before public access.

## Notes

- All money values are stored and displayed in INR.
- The database only lives in the Docker volume `roadmap_pgdata` — back it up (`pg_dump`) before doing anything destructive to Docker volumes.
