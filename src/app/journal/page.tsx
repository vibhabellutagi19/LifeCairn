import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { journalEntries } from "@/db/schema";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { JumpToDateForm } from "@/components/JumpToDateForm";
import { todayISO } from "@/lib/dates";
import { formatDateLong } from "@/lib/format";

export const dynamic = "force-dynamic";

const MOOD_EMOJI: Record<string, string> = {
  great: "😄",
  good: "🙂",
  okay: "😐",
  low: "😔",
  rough: "😣",
};

export default async function JournalPage() {
  const entries = await db
    .select()
    .from(journalEntries)
    .orderBy(desc(journalEntries.date))
    .limit(60);

  return (
    <div>
      <PageHeader
        title="Journal"
        subtitle="A line a day keeps the fog away."
        action={
          <Link
            href={`/journal/${todayISO()}`}
            className="brut-border brut-shadow-sm brut-press inline-flex min-h-11 w-full items-center justify-center rounded-md bg-orange px-4 py-2 text-sm font-bold uppercase tracking-wide text-white sm:w-auto"
          >
            Write today&apos;s entry
          </Link>
        }
      />

      <Card className="mb-6">
        <JumpToDateForm basePath="/journal" />
      </Card>

      <div className="space-y-3">
        {entries.length === 0 ? (
          <EmptyState>No journal entries yet. Start with today.</EmptyState>
        ) : (
          entries.map((e) => (
            <Link key={e.id} href={`/journal/${e.date}`}>
              <Card className="brut-press hover:bg-background">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <h3 className="font-display font-bold">{formatDateLong(e.date)}</h3>
                  {e.mood ? <Badge color="yellow">{MOOD_EMOJI[e.mood] ?? ""} {e.mood}</Badge> : null}
                </div>
                <p className="line-clamp-2 text-sm text-ink/80">{e.content || "(no content written)"}</p>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
