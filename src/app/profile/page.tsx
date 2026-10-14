import { PageHeader } from "@/components/ui";
import { NicknameForm } from "@/components/NicknameForm";
import { ModuleToggles } from "@/components/ModuleToggles";
import { requireUserId } from "@/lib/auth";
import { getDisabledModules } from "@/lib/moduleSettings";
import { MODULES } from "@/lib/modules";
import { getNickname } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ off?: string }>;
}) {
  const userId = await requireUserId();
  const [nickname, disabledModules, { off }] = await Promise.all([
    getNickname(userId),
    getDisabledModules(userId),
    searchParams,
  ]);
  const offModule = MODULES.find((m) => m.key === off && disabledModules.includes(m.key));

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader title="Profile" subtitle="Your name, email and sign-in live under your avatar in the sidebar." />
      {offModule ? (
        <p className="brut-border rounded-md bg-yellow/40 p-3 text-sm font-bold">
          {offModule.label} is switched off. Turn it on below to use it.
        </p>
      ) : null}
      <NicknameForm nickname={nickname} variant="profile" />
      <ModuleToggles disabledModules={disabledModules} />
    </div>
  );
}
