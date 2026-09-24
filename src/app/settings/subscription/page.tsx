import { redirect } from "next/navigation";
import { getUserSession } from "@/server/auth";
import { subscriptionSummary } from "@/server/subscriptions";
import { SubscriptionView } from "@/components/foundation/SubscriptionView";
export default async function Page() {
  if (!(await getUserSession())) redirect("/login");
  return (
    <SubscriptionView
      data={JSON.parse(JSON.stringify(await subscriptionSummary()))}
    />
  );
}
