// One-off setup: points the Telegram bot at this app's webhook and registers
// the command menu. Run after deploying, and again if the domain or secret changes:
//   npm run telegram:webhook
// Needs TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and APP_URL (https://...).
import "dotenv/config";

async function call(method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; description?: string };
  if (!json.ok) throw new Error(`${method}: ${json.description}`);
  console.log(`✓ ${method}`);
}

async function main() {
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, APP_URL } = process.env;
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_WEBHOOK_SECRET || !APP_URL) {
    throw new Error("Set TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and APP_URL first.");
  }
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(TELEGRAM_WEBHOOK_SECRET)) {
    throw new Error("TELEGRAM_WEBHOOK_SECRET may only use A-Z, a-z, 0-9, _ and - (try: openssl rand -hex 32).");
  }
  const url = `${APP_URL.replace(/\/$/, "")}/api/telegram`;
  await call("setWebhook", {
    url,
    secret_token: TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  await call("setMyCommands", {
    commands: [
      { command: "e", description: "Log an expense: /e 12.50 Lidl food #tag" },
      { command: "i", description: "Log income: /i 3200 salary" },
      { command: "h", description: "Tick today's habits" },
      { command: "t", description: "Update a project task's status" },
      { command: "today", description: "Today at a glance" },
      { command: "unlink", description: "Disconnect this chat" },
    ],
  });
  console.log(`Webhook set to ${url}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
