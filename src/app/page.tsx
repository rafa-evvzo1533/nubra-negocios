import { redirect } from "next/navigation";
import { getUserSession, getAccountSession } from "@/server/auth";
import { Landing } from "@/components/foundation/PublicShell";
import { postgres } from "@/server/postgres";
import { dashboard } from "@/server/dashboard";
import { Workspace } from "@/components/Workspace";
export default async function Home() {
  const session = await getUserSession();
  if (!session) {
    if (await getAccountSession()) redirect("/onboarding");
    return <Landing />;
  }
  const workspaces = (
    await postgres.query<{ id: string; name: string }>(
      "SELECT o.id,o.name FROM organization_members m JOIN organizations o ON o.id=m.organization_id WHERE m.user_id=$1 AND o.active ORDER BY o.name",
      [session.userId],
    )
  ).rows;
  return (
    <Workspace
      session={{
        name: session.name,
        organizationId: session.organizationId,
        organizationName: session.organizationName,
        role: session.role,
        permissions: session.permissions,
        currency: session.currency,
      }}
      workspaces={workspaces}
      summary={await dashboard(session)}
    />
  );
}
