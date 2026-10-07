import { auth } from "@clerk/nextjs/server";

// Clerk user id of the signed-in user. The proxy already redirects signed-out
// visitors, so a missing id here is a bug or an expired session.
export async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Not signed in");
  return userId;
}
