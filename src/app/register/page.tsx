import { PublicShell } from "@/components/foundation/PublicShell";
import { RegisterForm } from "@/components/foundation/AccountForms";
import { isMailConfigured } from "@/server/mail";
import { connection } from "next/server";
export default async function Page() {
  await connection();
  return (
    <PublicShell>
      <RegisterForm available={isMailConfigured()} />
    </PublicShell>
  );
}
