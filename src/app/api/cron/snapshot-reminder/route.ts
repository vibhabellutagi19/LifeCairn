import { timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { financeSnapshots, telegramLinks } from "@/db/schema";
import { getDisabledModules } from "@/lib/moduleSettings";
import { currentMonthKey } from "@/lib/dates";
import { formatMonthLabel } from "@/lib/financeView";
import { esc, sendMessage } from "@/lib/telegram/api";

// Month-end nudge: everyone with a linked Telegram chat and Finance switched on
// who hasn't saved this month's savings snapshot gets one message. Called by a
// cron job on the server (see DEPLOY.md), public in src/proxy.ts and
// authenticated by the CRON_SECRET header instead of Clerk.

export const dynamic = "force-dynamic";

function validSecret(header: string | null) {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!validSecret(request.headers.get("x-cron-secret"))) {
    return new Response("Forbidden", { status: 403 });
  }
  const month = currentMonthKey();
  const appUrl = process.env.APP_URL?.replace(/\/$/, "");
  const links = await db.select().from(telegramLinks);
  let sent = 0;

  for (const link of links) {
    if ((await getDisabledModules(link.userId)).includes("finance")) continue;
    const saved = await db.query.financeSnapshots.findFirst({
      where: and(eq(financeSnapshots.userId, link.userId), eq(financeSnapshots.month, month)),
    });
    if (saved) continue;
    const where = appUrl
      ? `<a href="${esc(`${appUrl}/finance/wealth?month=${month}#snapshot`)}">Update this month's values</a>`
      : "Open Finance → Wealth → Update values";
    await sendMessage(
      link.chatId,
      `📸 No savings snapshot for <b>${esc(formatMonthLabel(month))}</b> yet.\n${where} so your net worth history stays complete.`
    );
    sent++;
  }
  return Response.json({ month, sent });
}
