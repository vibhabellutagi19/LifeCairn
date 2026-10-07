import { PageHeader } from "@/components/ui";
import { NicknameForm } from "@/components/NicknameForm";
import { requireUserId } from "@/lib/auth";
import { getNickname } from "@/lib/profile";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const userId = await requireUserId();
  const nickname = await getNickname(userId);

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Profile" subtitle="Your name, email and sign-in live under your avatar in the sidebar." />
      <NicknameForm nickname={nickname} variant="profile" />
    </div>
  );
}
