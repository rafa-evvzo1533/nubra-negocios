import { redirect } from "next/navigation";
import { getAccountSession } from "@/server/auth";
import { applicationStatus } from "@/server/applications";
import { ApplicationForm } from "@/components/foundation/ApplicationForm";
import { PublicShell } from "@/components/foundation/PublicShell";
export default async function Page() {
  if (!(await getAccountSession())) redirect("/login");
  const data = await applicationStatus();
  return (
    <PublicShell>
      <ApplicationForm data={JSON.parse(JSON.stringify(data))} />
    </PublicShell>
  );
}
