import { auth } from "~/server/auth";

export default async function DashboardPage() {
  const session = await auth();

  if (!session) return <p>You are not logged in</p>;

  return <p>Hello, {session.user.name}!</p>;
}
