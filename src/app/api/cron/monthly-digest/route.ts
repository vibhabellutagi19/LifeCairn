import { db } from "@/db";
import { telegramLinks } from "@/db/schema";
import { getDisabledModules } from "@/lib/moduleSettings";
import { currentMonthKey, shiftMonthKey } from "@/lib/dates";
import { validCronSecret } from "@/lib/cronAuth";
import { buildReport, parsePeriod } from "@/lib/financeReport";
import { digestText } from "@/lib/financeDigest";
import { sendMessage } from "@/lib/telegram/api";

// On the 1st: last month's review, as one Telegram message, to everyone with a
// linked chat and Finance switched on who logged anything that month. Called
// by a cron job on the server (DEPLOY.md); public in src/proxy.ts and
// authenticated by the CRON_SECRET header.

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!validCronSecret(request)) return new Response("Forbidden", { status: 403 });
  const month = shiftMonthKey(currentMonthKey(), -1);
  const period = parsePeriod({ p: "month", at: month });
  const appUrl = process.env.APP_URL?.replace(/\/$/, "");
  const links = await db.select().from(telegramLinks);
  let sent = 0;

  for (const link of links) {
    if ((await getDisabledModules(link.userId)).includes("finance")) continue;
    const report = await buildReport(link.userId, period);
    if (report.income === 0 && report.expense === 0) continue;
    await sendMessage(link.chatId, digestText(report, appUrl));
    sent++;
  }
  return Response.json({ month, sent });
}
