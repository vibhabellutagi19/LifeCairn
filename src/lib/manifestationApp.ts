import { redirect } from "next/navigation";

/** Legacy routes and stale forms must use the standalone app after migration. */
export function openManifestation(path = "/manifestation"): never {
  const base = process.env.MANIFESTATION_APP_URL || "http://localhost:6002";
  redirect(new URL(path, base).href);
}

export async function requireManifestationApp(): Promise<string> {
  openManifestation();
}
