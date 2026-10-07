// Derived look for a habit: an icon guessed from its name and a stable accent colour.
// Nothing is stored, so renaming a habit can change its icon.

const ICONS: [RegExp, string][] = [
  [/walk|steps?\b/i, "🚶"],
  [/run|jog/i, "🏃"],
  [/gym|workout|lift|exercis|push.?up|squat/i, "🏋️"],
  [/yoga|stretch/i, "🧘"],
  [/meditat|breath|mindful/i, "🪷"],
  [/read|book/i, "📚"],
  [/water|hydrat|drink/i, "💧"],
  [/sleep|bed|wake/i, "😴"],
  [/journal|write|diary/i, "✍️"],
  [/code|leetcode|program|dsa/i, "💻"],
  [/learn|study|course|practice/i, "🧠"],
  [/cook|meal|eat|diet|veg|fruit/i, "🥗"],
  [/sugar|junk|alcohol|smok|no\s/i, "🚫"],
  [/skin|teeth|floss|care/i, "🧴"],
  [/clean|tidy|declutter/i, "🧹"],
  [/music|guitar|piano|sing/i, "🎵"],
  [/draw|paint|art|sketch/i, "🎨"],
  [/gratitude|thank|affirm|manifest|pray/i, "🙏"],
  [/phone|screen|social/i, "📵"],
  [/save|money|spend|budget/i, "💰"],
  [/call|family|friend/i, "📞"],
  [/swim/i, "🏊"],
  [/cycl|bike/i, "🚴"],
];

export function habitIcon(title: string) {
  return ICONS.find(([pattern]) => pattern.test(title))?.[1] ?? "✨";
}

export const HABIT_ACCENTS = ["#ff5b23", "#2b6cff", "#ff2d78", "#1f9d55", "#8b5cf6", "#e3a008", "#0ea5a4"];

export function habitAccent(id: number) {
  return HABIT_ACCENTS[id % HABIT_ACCENTS.length];
}
