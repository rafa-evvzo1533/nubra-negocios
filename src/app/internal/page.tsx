import { getStaffSession } from "@/server/auth";
import { reviewApplications } from "@/server/applications";
import { planCatalog } from "@/server/subscriptions";
import { postgres } from "@/server/postgres";
import { InternalConsole } from "@/components/foundation/InternalConsole";
export default async function Page() {
  const actor = await getStaffSession();
  if (!actor)
    return (
      <InternalConsole
        actor={null}
        applications={[]}
        organizations={[]}
        plans={[]}
      />
    );
  const { applications } = await reviewApplications();
  const organizations = (
    await postgres.query(
      `SELECT o.id,o.name,o.status,p.code AS plan,s.source,s.expires_at,(SELECT COUNT(*)::int FROM organization_members m WHERE m.organization_id=o.id) AS users,(SELECT requested_plan FROM upgrade_requests u WHERE u.organization_id=o.id AND u.status='PENDING') AS requested_plan FROM organizations o LEFT JOIN subscriptions s ON s.organization_id=o.id LEFT JOIN plans p ON p.id=s.plan_id ORDER BY o.created_at DESC LIMIT 200`,
    )
  ).rows;
  const props = JSON.parse(
    JSON.stringify({
      actor,
      applications,
      organizations,
      plans: await planCatalog(),
    }),
  );
  return <InternalConsole {...props} />;
}
