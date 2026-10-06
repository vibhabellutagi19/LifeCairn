/**
 * Splits an affirmation written as a list ("- I love X. - I love Y." or one per
 * line) into its statements, so long ones can be read line by line. A plain
 * single statement comes back as a one-item array.
 */
export function affirmationLines(text: string): string[] {
  const trimmed = text.trim();
  const byLine = trimmed.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const parts = byLine.length > 1 ? byLine : trimmed.split(/(?:^|\s)[-•]\s+/);
  const lines = parts.map((part) => part.replace(/^[-•]\s*/, "").trim()).filter(Boolean);
  return lines.length > 1 ? lines : [trimmed];
}
