# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run docker:up         # start local Postgres (docker-compose.yml); docker:down to stop
npm run db:push           # sync src/db/schema.ts to the DB (drizzle-kit push; no migration files are used)
npm run db:seed           # roadmaps/affirmations/accounts (needs SEED_USER_ID; skips if data exists)
npm run db:seed-projects  # Move & NimmaVasti projects/releases/tasks (needs SEED_USER_ID; skips if data exists)
npm run db:claim -- user_xxx  # one-off: assign pre-auth rows (user_id = 'legacy') to a Clerk user
npm run db:studio         # Drizzle Studio GUI
npm run dev               # next dev on port 6001 (not 3000)
npm run build / npm run lint
```

There is no test suite. `DATABASE_URL` comes from `.env` (see `.env.example`); `drizzle.config.ts` and the seed scripts load it via dotenv.

## Architecture

A local-first personal tracker (roadmaps, projects/releases/tasks, habits, affirmations, journal, finance, review) for a small, invite-only set of people (each with their own separate data). Next.js App Router + Clerk auth + Drizzle ORM + Postgres (`pg` Pool) + Tailwind v4. Path alias `@/` → `src/`. See README.md for the feature list.

- **Auth & data isolation**: Clerk (`@clerk/nextjs`). `src/proxy.ts` protects every route except `/sign-in` and `/sign-up`; sign-ups are restricted to invitations in the Clerk dashboard. Every table has a `user_id` (Clerk id) column. Every query and server action must call `requireUserId()` (`src/lib/auth.ts`) and filter by it (`and(eq(t.id, id), eq(t.userId, userId))`), set it on inserts, and use `ownsRow()` (`src/lib/ownership.ts`) to check a parent/linked row (roadmap, project, release, habit...) belongs to the user before linking to it. Per-user uniqueness (journal date, finance month, settings...) is `unique(userId, ...)`.
- **Data flow**: pages in `src/app/**/page.tsx` are async server components that query `db` directly (Drizzle, from `@/db`, scoped by user) and are marked `export const dynamic = "force-dynamic"`. There is no API layer.
- **Mutations**: all writes are server actions in `src/lib/actions/*.ts` (`"use server"`, one file per domain), taking `FormData` or plain args, then calling `revalidatePath`. Many actions define a local `revalidateAll()` listing every page that displays the affected data (e.g. tasks revalidate `/` and `/review`) — when adding a mutation or a new view of existing data, update those lists or pages will go stale.
- **Schema**: everything lives in `src/db/schema.ts`. Dates are stored as ISO `yyyy-MM-dd` strings (helpers in `src/lib/dates.ts`, built on date-fns), money is INR.
- **Derived, not stored**: habit/affirmation streaks and scores are computed live from check-in logs (`src/lib/habitStats.ts`, `affirmationStats.ts`); Focus Next ranking is computed in `src/lib/focusNext.ts`. Don't add stored columns for these.
- **Projects hierarchy**: roadmap (optional "Goal") → project → release → project_task (`projectTasks`; distinct from the daily `tasks` table). Project tasks appear on the Dashboard's Today's Tasks when today falls in their start/due window.
- **Task URLs**: `/projects/:id/tasks/[...taskRef]` is a catch-all because the ref is the task's feature branch name (may contain `/`, e.g. `feature/foo`) or its numeric id; use `src/lib/taskRef.ts` (`taskRefFor`/`parseTaskRef`) to build and resolve these.
- **UI**: shared neo-brutalist primitives (`Card`, `Button`, `Badge`, `Input`, `PageHeader`, …) are in `src/components/ui.tsx`; reuse them rather than styling ad hoc. Interactive pieces are client components in `src/components/`.
- **Next.js 16**: dynamic route `params` is a `Promise` and must be awaited. Check `node_modules/next/dist/docs/` before using unfamiliar APIs (see AGENTS.md).
