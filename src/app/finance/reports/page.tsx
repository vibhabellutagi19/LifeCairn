import Link from "next/link";
import { PageHeader } from "@/components/ui";
import {
  BudgetScorecard,
  CategoryChanges,
  CategoryTrends,
  MonthHighlights,
  PeriodPicker,
  ReportHeadline,
  SavingsRateBars,
  TagsPlacesIncome,
  WealthWaterfall,
} from "@/components/FinanceReportView";
import { requireModule } from "@/lib/moduleSettings";
import { buildReport, parsePeriod } from "@/lib/financeReport";
import { financeHref } from "@/lib/financeView";

export const dynamic = "force-dynamic";

export default async function FinanceReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; at?: string; from?: string; to?: string }>;
}) {
  const userId = await requireModule("finance");
  const period = parsePeriod(await searchParams);
  const report = await buildReport(userId, period);
  const isMonth = period.kind === "month";
  const empty = report.income === 0 && report.expense === 0;

  return (
    <div>
      <Link
        href={financeHref(period.to)}
        className="mb-3 inline-block text-xs font-bold uppercase tracking-wide text-blue hover:underline print:hidden"
      >
        ← Finance
      </Link>
      <PageHeader
        title={isMonth ? `${period.label} in review` : `Report: ${period.label}`}
        subtitle="What came in, what went out, how it compares with a usual month, and how your savings moved."
      />
      <PeriodPicker period={period} />

      {empty ? (
        <p className="brut-border mb-4 rounded-md bg-yellow/40 px-4 py-3 text-sm font-bold">
          Nothing was logged in {period.label}. Pick another period above.
        </p>
      ) : null}

      <div className="space-y-4">
        <ReportHeadline report={report} />
        {isMonth ? <MonthHighlights report={report} /> : <SavingsRateBars report={report} />}
        <div className={report.budgets.length > 0 ? "grid grid-cols-1 gap-4 lg:grid-cols-2" : ""}>
          <CategoryChanges report={report} />
          <BudgetScorecard report={report} />
        </div>
        <CategoryTrends report={report} />
        <TagsPlacesIncome report={report} />
        <WealthWaterfall report={report} />
      </div>
    </div>
  );
}
