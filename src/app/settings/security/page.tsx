import { redirect } from "next/navigation";
import { getAccountSession, getUserSession } from "@/server/auth";
import { SecurityView } from "@/components/foundation/SecurityView";
export default async function Page() {
  if (!(await getAccountSession())) redirect("/login");
  const user = await getUserSession();
  return <SecurityView owner={user?.role === "OWNER"} />;
}
