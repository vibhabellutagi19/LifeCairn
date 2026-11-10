import { timingSafeEqual } from "node:crypto";
import { handleUpdate, type TelegramUpdate } from "@/lib/telegram/bot";

// Telegram webhook. This is the app's one API route: Telegram can't call
// server actions. It is public in src/proxy.ts and authenticated instead by
// the secret token Telegram sends with every request (set by
// `npm run telegram:webhook`). Each chat only reaches the user it is linked to.

export const dynamic = "force-dynamic";

function validSecret(header: string | null) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!validSecret(request.headers.get("x-telegram-bot-api-secret-token"))) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    await handleUpdate((await request.json()) as TelegramUpdate);
  } catch (error) {
    // Always acknowledge, or Telegram redelivers the same update repeatedly.
    console.error("[telegram] update failed", error);
  }
  return new Response("ok");
}
