// The monthly Telegram digest: a finished month's report as one short message.

import type { FinanceReport } from "@/lib/financeReport";
import { formatEUR } from "@/lib/format";
import { esc } from "@/lib/telegram/api";

function ordinal(n: number) {
  return n === 1 ? "best" : `${n}${n === 2 ? "nd" : n === 3 ? "rd" : "th"} best`;
}

export function digestText(report: FinanceReport, appUrl: string | undefined) {
  const { period, highlights: h, usual } = report;
  const lines: string[] = [`📊 <b>${esc(period.label)} in review</b>`, ""];
  if (report.kept >= 0) {
    const rank = h?.rank ? `, your ${ordinal(h.rank.position)} month` : "";
    lines.push(`You kept <b>${formatEUR(report.kept)}</b>${report.rate !== null ? ` (${Math.round(report.rate)}% saved)` : ""}${rank}.`);
  } else {
    lines.push(`You spent <b>${formatEUR(-report.kept)}</b> more than came in.`);
  }
  lines.push(`In ${formatEUR(report.income)} · Out ${formatEUR(report.expense)}`);
  if (usual) lines.push(`A usual month: out ${formatEUR(usual.expense)}`);

  const moves = report.categories
    .filter((c) => c.usualPerMonth !== null)
    .map((c) => ({ category: c.category, delta: c.perMonth - (c.usualPerMonth ?? 0) }))
    .filter((c) => Math.abs(c.delta) >= 1)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  if (moves[0]) {
    const m = moves[0];
    lines.push(`Biggest change: ${esc(m.category)} ${m.delta > 0 ? "+" : "−"}${formatEUR(Math.abs(m.delta))}`);
  }
  if (report.budgets.length > 0) {
    lines.push(`Budgets kept: ${report.budgets.filter((b) => b.spent <= b.limit).length} of ${report.budgets.length}`);
  }
  if (h) {
    lines.push(`${h.noSpendDays} no-spend ${h.noSpendDays === 1 ? "day" : "days"}`);
    for (const m of h.maturing) lines.push(`⏳ ${esc(m.name)} matures on ${m.date}`);
  }
  if (appUrl) {
    const url = `${appUrl}/finance/reports?${new URLSearchParams({ p: "month", at: period.from })}`;
    lines.push("", `<a href="${esc(url)}">Open the full report</a>`);
  }
  return lines.join("\n");
}
