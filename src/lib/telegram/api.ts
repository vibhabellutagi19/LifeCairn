// Minimal Telegram Bot API client. Failures are logged, never thrown, so one
// bad call can't make Telegram retry the whole update.

export type InlineButton = { text: string; callback_data: string };
export type InlineKeyboard = InlineButton[][];

function token() {
  return process.env.TELEGRAM_BOT_TOKEN ?? "";
}

export async function tg<T = unknown>(method: string, body: Record<string, unknown>): Promise<T | null> {
  if (!token()) {
    console.error("[telegram] TELEGRAM_BOT_TOKEN is not set");
    return null;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
    if (!json.ok) {
      console.error(`[telegram] ${method} failed: ${json.description}`);
      return null;
    }
    return json.result ?? null;
  } catch (error) {
    console.error(`[telegram] ${method} error`, error);
    return null;
  }
}

/** Escape text for parse_mode HTML. */
export function esc(text: string) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function sendMessage(chatId: string, text: string, keyboard?: InlineKeyboard) {
  return tg("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });
}

export function editMessage(chatId: string, messageId: number, text: string, keyboard?: InlineKeyboard) {
  return tg("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: keyboard ?? [] },
  });
}

export function answerCallback(callbackQueryId: string, text?: string) {
  return tg("answerCallbackQuery", { callback_query_id: callbackQueryId, ...(text ? { text } : {}) });
}
