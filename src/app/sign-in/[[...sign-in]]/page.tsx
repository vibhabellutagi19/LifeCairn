import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-[70dvh] w-full items-center justify-center">
      <SignIn />
    </div>
  );
}
