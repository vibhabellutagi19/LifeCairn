export const EMOTIONS = [
  { key: "joyful", label: "Joyful", emoji: "😊", category: "positive" },
  { key: "calm", label: "Calm", emoji: "😌", category: "positive" },
  { key: "energized", label: "Energized", emoji: "⚡", category: "positive" },
  { key: "okay", label: "Okay", emoji: "🙂", category: "positive" },
  { key: "anxious", label: "Anxious", emoji: "😟", category: "negative" },
  { key: "sad", label: "Sad", emoji: "😔", category: "negative" },
  { key: "angry", label: "Angry", emoji: "😤", category: "negative" },
  { key: "drained", label: "Drained", emoji: "🪫", category: "negative" },
] as const;

// "missing" = feelings the user wants more of (e.g. for manifestation); user-created only.
export type EmotionCategory = "positive" | "negative" | "missing";
export type EmotionOption = {
  key: string;
  label: string;
  emoji: string;
  category: EmotionCategory;
};
export type BuiltInEmotionKey = (typeof EMOTIONS)[number]["key"];

export function isBuiltInEmotionKey(value: string): value is BuiltInEmotionKey {
  return EMOTIONS.some((emotion) => emotion.key === value);
}

export function customEmotionKey(id: number) {
  return `custom:${id}`;
}

export function customEmotionId(value: string) {
  const match = /^custom:(\d+)$/.exec(value);
  return match ? Number(match[1]) : null;
}

export function formatHour(hour: number) {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}
