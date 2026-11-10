import { revalidatePath } from "next/cache";
import { and, asc, eq, gt, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  financeEntries,
  habitLogs,
  habits,
  projectTasks,
  projects,
  telegramLinkCodes,
  telegramLinks,
} from "@/db/schema";
import { currentMonthKey, monthRangeISO, todayISO } from "@/lib/dates";
import { EXPENSE_CATEGORIES } from "@/lib/financeCategories";
import { formatDateShort, formatEUR } from "@/lib/format";
import { getDisabledModules } from "@/lib/moduleSettings";
import type { ModuleKey } from "@/lib/modules";
import { answerCallback, editMessage, esc, sendMessage, type InlineKeyboard } from "@/lib/telegram/api";
import { parseEntry } from "@/lib/telegram/parse";

// The subset of a Telegram Update this bot reads.
export type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; type: string };
    from?: { username?: string };
    text?: string;
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: { message_id: number; chat: { id: number } };
  };
};

const TASK_STATUSES = [
  { key: "in_progress", label: "▶ In progress" },
  { key: "blocked", label: "■ Blocked" },
  { key: "done", label: "✓ Done" },
  { key: "not_started", label: "↺ Not started" },
] as const;
const OPEN_TASK_STATUSES = ["in_progress", "not_started", "blocked"] as const;
const STATUS_LABEL: Record<string, string> = {
  in_progress: "in progress",
  not_started: "not started",
  blocked: "blocked",
  done: "done",
  backlog: "backlog",
};

const HELP = [
  "<b>LifeCairn bot</b>",
  "",
  "<b>/e</b> 12.50 Lidl food #trip — log an expense",
  "   category, #tags and a date are optional",
  "   dates: <i>yesterday</i>, <i>3d</i> (3 days ago), <i>mon</i>, <i>3/11</i>, <i>2026-11-03</i>",
  "<b>/i</b> 3200 salary — log income",
  "<b>/h</b> — tick today's habits",
  "<b>/t</b> — update a project task's status",
  "<b>/today</b> — today at a glance",
  "<b>/unlink</b> — disconnect this chat",
].join("\n");

function revalidateFinance() {
  revalidatePath("/finance");
  revalidatePath("/");
  revalidatePath("/review");
}

function revalidateHabits() {
  revalidatePath("/habits");
  revalidatePath("/habits/rewards");
  revalidatePath("/");
}

function revalidateProject(projectId: number) {
  revalidatePath("/projects");
  revalidatePath("/");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/tasks`, "layout");
  revalidatePath(`/projects/${projectId}/releases`, "layout");
}

async function linkedUser(chatId: string) {
  const row = await db.query.telegramLinks.findFirst({ where: eq(telegramLinks.chatId, chatId) });
  return row?.userId ?? null;
}

async function moduleOff(userId: string, key: ModuleKey) {
  return (await getDisabledModules(userId)).includes(key);
}

/* ------------------------------------------------------------------ */
/* Linking                                                             */
/* ------------------------------------------------------------------ */

async function linkChat(chatId: string, code: string, username: string | undefined) {
  const row = await db.query.telegramLinkCodes.findFirst({
    where: and(eq(telegramLinkCodes.code, code), gt(telegramLinkCodes.expiresAt, new Date())),
  });
  if (!row) {
    await sendMessage(chatId, "That link code is invalid or expired. Make a new one on your LifeCairn Profile page.");
    return;
  }
  await db.transaction(async (tx) => {
    await tx.delete(telegramLinkCodes).where(eq(telegramLinkCodes.userId, row.userId));
    // A chat belongs to one user and a user to one chat: drop either old link.
    await tx
      .delete(telegramLinks)
      .where(or(eq(telegramLinks.chatId, chatId), eq(telegramLinks.userId, row.userId)));
    await tx.insert(telegramLinks).values({ userId: row.userId, chatId, telegramUsername: username ?? null });
  });
  revalidatePath("/profile");
  await sendMessage(chatId, `✓ Linked to your LifeCairn account.\n\n${HELP}`);
}

/* ------------------------------------------------------------------ */
/* Finance                                                             */
/* ------------------------------------------------------------------ */

function categoryKeyboard(entryId: number): InlineKeyboard {
  const rows: InlineKeyboard = [];
  EXPENSE_CATEGORIES.forEach((c, i) => {
    if (i % 3 === 0) rows.push([]);
    rows[rows.length - 1].push({ text: c, callback_data: `ec:${entryId}:${i}` });
  });
  rows.push([{ text: "↩ Undo", callback_data: `eu:${entryId}` }]);
  return rows;
}

function entryLine(entry: { type: string; amount: string | number; source: string; category: string; date: string; tags: string[] }) {
  const parts = [
    `${entry.type === "income" ? "Income" : "Expense"} <b>${formatEUR(entry.amount)}</b>`,
    esc(entry.source),
    ...(entry.type === "expense" ? [esc(entry.category)] : []),
    ...entry.tags.map((t) => `#${esc(t)}`),
  ];
  const day = entry.date === todayISO() ? "" : ` · ${formatDateShort(entry.date)}`;
  return `✓ ${parts.join(" · ")}${day}`;
}

async function logEntry(chatId: string, userId: string, kind: "expense" | "income", args: string) {
  if (await moduleOff(userId, "finance")) {
    await sendMessage(chatId, "Finance is switched off in your LifeCairn Profile.");
    return;
  }
  if (!args.trim()) {
    await sendMessage(
      chatId,
      kind === "expense" ? "Send it like: <b>/e 12.50 Lidl food #trip</b>" : "Send it like: <b>/i 3200 salary</b>"
    );
    return;
  }
  const parsed = parseEntry(args, kind);
  if (!parsed.ok) {
    await sendMessage(chatId, `${parsed.error} Try: <b>${kind === "expense" ? "/e 12.50 Lidl" : "/i 3200 salary"}</b>`);
    return;
  }
  const { amount, source, category, guessed, tags, date } = parsed.entry;
  const [entry] = await db
    .insert(financeEntries)
    .values({
      userId,
      type: kind,
      amount: amount.toFixed(2),
      source,
      category: kind === "expense" ? (category ?? "Other") : "Other",
      tags,
      date,
    })
    .returning();
  revalidateFinance();

  if (kind === "income") {
    await sendMessage(chatId, entryLine(entry), [[{ text: "↩ Undo", callback_data: `eu:${entry.id}` }]]);
    return;
  }
  // No category, or only a guess: offer the picker so it can be fixed with one tap.
  const note = !category ? "\nPick a category:" : guessed ? "\nWrong category? Tap another:" : "";
  await sendMessage(
    chatId,
    `${entryLine(entry)}${note}`,
    !category || guessed ? categoryKeyboard(entry.id) : [[{ text: "↩ Undo", callback_data: `eu:${entry.id}` }]]
  );
}

async function setEntryCategory(chatId: string, messageId: number, userId: string, entryId: number, index: number) {
  const category = EXPENSE_CATEGORIES[index];
  if (!category) return;
  const [entry] = await db
    .update(financeEntries)
    .set({ category })
    .where(and(eq(financeEntries.id, entryId), eq(financeEntries.userId, userId), eq(financeEntries.type, "expense")))
    .returning();
  if (!entry) {
    await editMessage(chatId, messageId, "That expense no longer exists.");
    return;
  }
  revalidateFinance();
  await editMessage(chatId, messageId, entryLine(entry), [[{ text: "↩ Undo", callback_data: `eu:${entry.id}` }]]);
}

async function undoEntry(chatId: string, messageId: number, userId: string, entryId: number) {
  const [entry] = await db
    .delete(financeEntries)
    .where(and(eq(financeEntries.id, entryId), eq(financeEntries.userId, userId)))
    .returning();
  if (entry) revalidateFinance();
  await editMessage(
    chatId,
    messageId,
    entry ? `<s>${esc(entry.source)} ${formatEUR(entry.amount)}</s> — removed.` : "Already removed."
  );
}

/* ------------------------------------------------------------------ */
/* Habits                                                              */
/* ------------------------------------------------------------------ */

async function habitView(userId: string) {
  const today = todayISO();
  const active = await db
    .select({ id: habits.id, title: habits.title })
    .from(habits)
    .where(
      and(
        eq(habits.userId, userId),
        eq(habits.active, true),
        or(isNull(habits.endDate), gte(habits.endDate, today))
      )
    )
    .orderBy(asc(habits.sortOrder), asc(habits.id));
  const done = new Set(
    active.length
      ? (
          await db
            .select({ habitId: habitLogs.habitId })
            .from(habitLogs)
            .where(
              and(
                eq(habitLogs.userId, userId),
                eq(habitLogs.date, today),
                inArray(
                  habitLogs.habitId,
                  active.map((h) => h.id)
                )
              )
            )
        ).map((r) => r.habitId)
      : []
  );
  if (active.length === 0) {
    return { text: "You have no active habits.", keyboard: [] as InlineKeyboard, done: 0, total: 0 };
  }
  const keyboard: InlineKeyboard = active.map((h) => [
    { text: `${done.has(h.id) ? "✅" : "⬜"} ${h.title}`.slice(0, 64), callback_data: `h:${h.id}` },
  ]);
  return {
    text: `<b>Habits today</b> · ${done.size}/${active.length} done\nTap to tick or untick.`,
    keyboard,
    done: done.size,
    total: active.length,
  };
}

async function showHabits(chatId: string, userId: string) {
  if (await moduleOff(userId, "habits")) {
    await sendMessage(chatId, "Habits are switched off in your LifeCairn Profile.");
    return;
  }
  const view = await habitView(userId);
  await sendMessage(chatId, view.text, view.keyboard);
}

async function toggleHabit(chatId: string, messageId: number, userId: string, habitId: number) {
  const today = todayISO();
  const habit = await db.query.habits.findFirst({ where: and(eq(habits.id, habitId), eq(habits.userId, userId)) });
  if (!habit) return;
  const removed = await db
    .delete(habitLogs)
    .where(and(eq(habitLogs.userId, userId), eq(habitLogs.habitId, habitId), eq(habitLogs.date, today)))
    .returning({ id: habitLogs.id });
  if (removed.length === 0) {
    await db
      .insert(habitLogs)
      .values({ userId, habitId, date: today })
      .onConflictDoNothing({ target: [habitLogs.habitId, habitLogs.date] });
  }
  revalidateHabits();
  const view = await habitView(userId);
  await editMessage(chatId, messageId, view.text, view.keyboard);
}

/* ------------------------------------------------------------------ */
/* Project tasks                                                       */
/* ------------------------------------------------------------------ */

async function taskListView(userId: string) {
  const rows = await db
    .select({
      id: projectTasks.id,
      title: projectTasks.title,
      status: projectTasks.status,
      project: projects.name,
    })
    .from(projectTasks)
    .innerJoin(projects, and(eq(projects.id, projectTasks.projectId), eq(projects.userId, userId)))
    .where(and(eq(projectTasks.userId, userId), inArray(projectTasks.status, [...OPEN_TASK_STATUSES])))
    .orderBy(
      sql`case ${projectTasks.status} when 'in_progress' then 0 when 'blocked' then 1 else 2 end`,
      sql`case ${projectTasks.priority} when 'high' then 0 when 'medium' then 1 else 2 end`,
      asc(projectTasks.dueDate),
      asc(projectTasks.id)
    )
    .limit(20);
  if (rows.length === 0) return { text: "No open project tasks. 🎉", keyboard: [] as InlineKeyboard };
  const icon: Record<string, string> = { in_progress: "▶", blocked: "■", not_started: "○" };
  const keyboard: InlineKeyboard = rows.map((t) => [
    { text: `${icon[t.status] ?? "○"} ${t.title} · ${t.project}`.slice(0, 64), callback_data: `tk:${t.id}` },
  ]);
  return { text: "<b>Open tasks</b> — tap one to change its status.", keyboard };
}

async function showTasks(chatId: string, userId: string) {
  if (await moduleOff(userId, "projects")) {
    await sendMessage(chatId, "Projects are switched off in your LifeCairn Profile.");
    return;
  }
  const view = await taskListView(userId);
  await sendMessage(chatId, view.text, view.keyboard);
}

async function pickTaskStatus(chatId: string, messageId: number, userId: string, taskId: number) {
  const [task] = await db
    .select({ title: projectTasks.title, status: projectTasks.status, project: projects.name })
    .from(projectTasks)
    .innerJoin(projects, eq(projects.id, projectTasks.projectId))
    .where(and(eq(projectTasks.id, taskId), eq(projectTasks.userId, userId)))
    .limit(1);
  if (!task) {
    await editMessage(chatId, messageId, "That task no longer exists.");
    return;
  }
  const options = TASK_STATUSES.filter((s) => s.key !== task.status).map((s) => ({
    text: s.label,
    callback_data: `ts:${taskId}:${TASK_STATUSES.findIndex((x) => x.key === s.key)}`,
  }));
  await editMessage(
    chatId,
    messageId,
    `<b>${esc(task.title)}</b>\n${esc(task.project)} · now ${STATUS_LABEL[task.status] ?? task.status}`,
    [options.slice(0, 2), options.slice(2), [{ text: "‹ Back to tasks", callback_data: "tl" }]]
  );
}

async function setTaskStatus(chatId: string, messageId: number, userId: string, taskId: number, index: number) {
  const status = TASK_STATUSES[index]?.key;
  if (!status) return;
  const [task] = await db
    .update(projectTasks)
    .set({ status })
    .where(and(eq(projectTasks.id, taskId), eq(projectTasks.userId, userId)))
    .returning({ title: projectTasks.title, projectId: projectTasks.projectId });
  if (!task) {
    await editMessage(chatId, messageId, "That task no longer exists.");
    return;
  }
  revalidateProject(task.projectId);
  await editMessage(chatId, messageId, `✓ <b>${esc(task.title)}</b> is now ${STATUS_LABEL[status]}.`, [
    [{ text: "‹ Back to tasks", callback_data: "tl" }],
  ]);
}

/* ------------------------------------------------------------------ */
/* Today                                                               */
/* ------------------------------------------------------------------ */

async function showToday(chatId: string, userId: string) {
  const disabled = await getDisabledModules(userId);
  const today = todayISO();
  const lines = [`<b>Today</b> · ${formatDateShort(today)}`];

  if (!disabled.includes("finance")) {
    const { start, end } = monthRangeISO(currentMonthKey());
    const [row] = await db
      .select({
        today: sql<string>`coalesce(sum(${financeEntries.amount}) filter (where ${financeEntries.date} = ${today}), 0)`,
        month: sql<string>`coalesce(sum(${financeEntries.amount}), 0)`,
      })
      .from(financeEntries)
      .where(
        and(
          eq(financeEntries.userId, userId),
          eq(financeEntries.type, "expense"),
          gte(financeEntries.date, start),
          lte(financeEntries.date, end)
        )
      );
    lines.push(`💸 Spent today ${formatEUR(row?.today ?? 0)} · this month ${formatEUR(row?.month ?? 0)}`);
  }
  if (!disabled.includes("habits")) {
    const { done, total } = await habitView(userId);
    lines.push(total > 0 ? `🔥 Habits ${done}/${total} done` : "🔥 No active habits");
  }
  if (!disabled.includes("projects")) {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(projectTasks)
      .where(and(eq(projectTasks.userId, userId), eq(projectTasks.status, "in_progress")));
    lines.push(`▶ ${row?.count ?? 0} tasks in progress`);
  }
  await sendMessage(chatId, lines.join("\n"));
}

/* ------------------------------------------------------------------ */
/* Dispatch                                                            */
/* ------------------------------------------------------------------ */

async function handleMessage(message: NonNullable<TelegramUpdate["message"]>) {
  const chatId = String(message.chat.id);
  const text = (message.text ?? "").trim();
  if (message.chat.type !== "private") {
    await sendMessage(chatId, "Please message me in a private chat.");
    return;
  }
  // "/e@MyBot 12 lidl" → command "e", args "12 lidl".
  const match = text.match(/^\/([a-z]+)(?:@\w+)?\s*([\s\S]*)$/i);
  const command = match?.[1].toLowerCase() ?? "";
  const args = match?.[2] ?? text;

  if (command === "start" && args) {
    await linkChat(chatId, args.trim(), message.from?.username);
    return;
  }

  const userId = await linkedUser(chatId);
  if (!userId) {
    await sendMessage(
      chatId,
      "This chat isn't linked yet. In LifeCairn, open <b>Profile → Telegram</b> and tap <b>Link Telegram</b>."
    );
    return;
  }

  switch (command) {
    case "e":
    case "expense":
      return logEntry(chatId, userId, "expense", args);
    case "i":
    case "income":
      return logEntry(chatId, userId, "income", args);
    case "h":
    case "habits":
      return showHabits(chatId, userId);
    case "t":
    case "tasks":
      return showTasks(chatId, userId);
    case "today":
      return showToday(chatId, userId);
    case "unlink":
      await db.delete(telegramLinks).where(eq(telegramLinks.chatId, chatId));
      revalidatePath("/profile");
      return void (await sendMessage(chatId, "Unlinked. Link again any time from your Profile page."));
    case "":
      // Plain text with an amount is treated as an expense, e.g. "12.50 lidl".
      if (parseEntry(text, "expense").ok) return logEntry(chatId, userId, "expense", text);
      return void (await sendMessage(chatId, HELP));
    default:
      return void (await sendMessage(chatId, HELP));
  }
}

async function handleCallback(query: NonNullable<TelegramUpdate["callback_query"]>) {
  const message = query.message;
  if (!message) return void (await answerCallback(query.id));
  const chatId = String(message.chat.id);
  const userId = await linkedUser(chatId);
  if (!userId) return void (await answerCallback(query.id, "This chat isn't linked."));

  const [kind, a, b] = (query.data ?? "").split(":");
  const id = Number(a);
  const index = Number(b);
  await answerCallback(query.id);
  const mid = message.message_id;

  if (kind === "ec" && Number.isInteger(id)) return setEntryCategory(chatId, mid, userId, id, index);
  if (kind === "eu" && Number.isInteger(id)) return undoEntry(chatId, mid, userId, id);
  if (kind === "h" && Number.isInteger(id)) return toggleHabit(chatId, mid, userId, id);
  if (kind === "tk" && Number.isInteger(id)) return pickTaskStatus(chatId, mid, userId, id);
  if (kind === "ts" && Number.isInteger(id)) return setTaskStatus(chatId, mid, userId, id, index);
  if (kind === "tl") {
    const view = await taskListView(userId);
    return void (await editMessage(chatId, mid, view.text, view.keyboard));
  }
}

export async function handleUpdate(update: TelegramUpdate) {
  if (update.message) return handleMessage(update.message);
  if (update.callback_query) return handleCallback(update.callback_query);
}
