import { openManifestation } from "@/lib/manifestationApp";

export default async function Page({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  openManifestation(`/journal/${encodeURIComponent(date)}`);
}
