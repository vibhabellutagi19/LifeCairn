import { timingSafeEqual } from "node:crypto";

/** True when the request carries the CRON_SECRET header (never when the secret is unset). */
export function validCronSecret(request: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const header = request.headers.get("x-cron-secret");
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
