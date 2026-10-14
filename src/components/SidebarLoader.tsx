import { auth } from "@clerk/nextjs/server";
import { Sidebar } from "@/components/Sidebar";
import { getDisabledModules } from "@/lib/moduleSettings";

export async function SidebarLoader() {
  const { userId } = await auth();
  const disabledModules = userId ? await getDisabledModules(userId) : [];
  return <Sidebar disabledModules={disabledModules} />;
}
