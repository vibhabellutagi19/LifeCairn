import { desc } from "drizzle-orm";
import { db } from "@/db";
import { hooponoponoRounds } from "@/db/schema";
import { PageHeader } from "@/components/ui";
import { HooponoponoPractice } from "@/components/HooponoponoPractice";
import { HooponoponoHistory } from "@/components/HooponoponoHistory";
import { todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function HooponoponoPage() {
  const today = todayISO();
  const sessions = await db.select().from(hooponoponoRounds).orderBy(desc(hooponoponoRounds.date), desc(hooponoponoRounds.completedAt));
  const recentIntentions = [
    ...new Set(sessions.map((session) => session.intention?.trim()).filter((v): v is string => Boolean(v))),
  ].slice(0, 6);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Hoʻoponopono"
        subtitle="I'm sorry · Please forgive me · Thank you · I love you. Count to a number, or keep it open and conversational."
      />
      <HooponoponoPractice date={today} recentIntentions={recentIntentions} />
      <HooponoponoHistory sessions={sessions} today={today} />
    </div>
  );
}
