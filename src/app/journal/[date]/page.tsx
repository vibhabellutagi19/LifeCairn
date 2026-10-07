import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { journalEntries } from "@/db/schema";
import { Button, Card, PageHeader, Select, Textarea } from "@/components/ui";
import { requireUserId } from "@/lib/auth";
import { saveJournalEntry } from "@/lib/actions/journal";
import { formatDateLong } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function JournalEntryPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const userId = await requireUserId();
  const { date } = await params;
  const entry = await db.query.journalEntries.findFirst({
    where: and(eq(journalEntries.userId, userId), eq(journalEntries.date, date)),
  });

  return (
    <div>
      <Link href="/journal" className="mb-4 inline-block text-sm font-bold underline underline-offset-4">
        &larr; All entries
      </Link>
      <PageHeader title={formatDateLong(date)} subtitle="Journal entry" />

      <Card>
        <form action={saveJournalEntry.bind(null, date)} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide">
              How was today?
            </label>
            <Textarea
              name="content"
              rows={10}
              placeholder="Write whatever's on your mind..."
              defaultValue={entry?.content ?? ""}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide">
              Gratitude / wins
            </label>
            <Textarea
              name="gratitude"
              rows={3}
              placeholder="What are you grateful for today?"
              defaultValue={entry?.gratitude ?? ""}
            />
          </div>
          <div className="max-w-xs">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide">Mood</label>
            <Select name="mood" defaultValue={entry?.mood ?? ""}>
              <option value="">Not set</option>
              <option value="great">😄 Great</option>
              <option value="good">🙂 Good</option>
              <option value="okay">😐 Okay</option>
              <option value="low">😔 Low</option>
              <option value="rough">😣 Rough</option>
            </Select>
          </div>
          <Button type="submit" variant="primary">
            Save Entry
          </Button>
        </form>
      </Card>
    </div>
  );
}
