import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-[70dvh] w-full items-center justify-center">
      <SignUp />
    </div>
  );
}
