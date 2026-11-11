// Parses savings history pasted from a spreadsheet into monthly snapshots.
// Pure and shared: the import dialog uses it for the preview; the server action
// validates the structured result again before writing.
//
// Expected layout (tab-separated, as copied from Google Sheets / Excel):
//
//   Monthly      ·              · Invested      · Total
//   25/10/2025   · Zerodha MF   · 48,180.53     · 57,408.94
//                · FD           · 150,000.00    · 151623
//                · Total        · 2,317,993.52  · 2,577,278.32 · 11.19
//
// A date in the first column starts a month; rows under it (first cell empty)
// belong to it. "Total" rows are kept only to check the sum. Header rows and
// anything without two numbers are ignored.

export type ImportRow = { name: string; invested: number; current: number };

export type ImportMonth = {
  /** yyyy-MM */
  month: string;
  /** yyyy-MM-dd, the date written in the sheet. */
  snapshotDate: string;
  rows: ImportRow[];
  /** The sheet's own "Total" row, when it has one. */
  sheetTotal: { invested: number; current: number } | null;
};

export type ParsedHistory = {
  months: ImportMonth[];
  /** Lines that looked like data but couldn't be used, for the preview. */
  skipped: string[];
  /** Months that appeared more than once; the later block wins. */
  duplicates: string[];
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function validISO(y: number, m: number, d: number) {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1) return null;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= last ? `${y}-${pad(m)}-${pad(d)}` : null;
}

/** 25/10/2025 · 25-10-25 · 2025-10-25 · Oct 2025 / October 2025 (→ last day). */
export function parseSheetDate(raw: string): string | null {
  const text = raw.trim();
  let m = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (m) {
    const y = Number(m[3]);
    return validISO(y < 100 ? 2000 + y : y, Number(m[2]), Number(m[1]));
  }
  m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return validISO(Number(m[1]), Number(m[2]), Number(m[3]));
  m = text.match(/^([a-z]{3,9})[\s-]+(\d{4})$/i);
  if (m) {
    const month = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1;
    if (month === 0) return null;
    const y = Number(m[2]);
    return validISO(y, month, new Date(Date.UTC(y, month, 0)).getUTCDate());
  }
  return null;
}

/** "1,266,400.83" · "₹ 1,26,640" · "151623" → number; anything else → null. */
export function parseSheetNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(/[₹€$\s,]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function cellsOf(line: string) {
  // Spreadsheets paste tabs; fall back to runs of 2+ spaces for hand-typed text.
  return (line.includes("\t") ? line.split("\t") : line.split(/ {2,}/)).map((c) => c.trim());
}

export function parseHistory(text: string): ParsedHistory {
  const byMonth = new Map<string, ImportMonth>();
  const skipped: string[] = [];
  const duplicates = new Set<string>();
  let current: ImportMonth | null = null;

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = cellsOf(line);
    const date = cells[0] ? parseSheetDate(cells[0]) : null;
    if (date) {
      const month = date.slice(0, 7);
      if (byMonth.has(month)) duplicates.add(month);
      current = { month, snapshotDate: date, rows: [], sheetTotal: null };
      byMonth.set(month, current);
    } else if (cells[0]) {
      // A non-date in the first column (e.g. the "Monthly" header): not a saving row.
      continue;
    }

    const name = cells[1] ?? "";
    const invested = parseSheetNumber(cells[2] ?? "");
    const value = parseSheetNumber(cells[3] ?? "");
    if (!name && invested === null && value === null) continue;
    if (!name || invested === null || value === null || invested < 0 || value < 0) {
      if (name || invested !== null || value !== null) skipped.push(line.trim());
      continue;
    }
    if (!current) {
      skipped.push(line.trim());
      continue;
    }
    if (/^(grand\s+)?total$/i.test(name)) {
      current.sheetTotal = { invested, current: value };
      continue;
    }
    current.rows.push({ name: name.slice(0, 200), invested, current: value });
  }

  return {
    months: [...byMonth.values()].filter((m) => m.rows.length > 0).sort((a, b) => a.month.localeCompare(b.month)),
    skipped,
    duplicates: [...duplicates],
  };
}

/** Name used to match a sheet row to a saving: case, spacing and punctuation ignored. */
export function matchKey(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** The payload the import action accepts. */
export type HistoryImportPayload = {
  months: {
    month: string;
    snapshotDate: string;
    items: { accountId: number; invested: number; current: number }[];
  }[];
};
