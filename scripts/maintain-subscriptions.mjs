import pg from "pg";
import { createHmac, randomUUID } from "node:crypto";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
let failures = 0;
async function provider(path) {
  const response = await fetch("https://api.mercadopago.com" + path, {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("Provider lookup failed");
  return response.json();
}
async function reconcile(id, type) {
  const ts = String(Date.now()),
    requestId = randomUUID();
  const signature = createHmac("sha256", process.env.MP_WEBHOOK_SECRET)
    .update(`id:${String(id).toLowerCase()};request-id:${requestId};ts:${ts};`)
    .digest("hex");
  const url = new URL(
    "/api/billing/mercadopago/subscriptions",
    process.env.APP_URL,
  );
  url.searchParams.set("data.id", String(id));
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-request-id": requestId,
      "x-signature": `ts=${ts},v1=${signature}`,
    },
    body: JSON.stringify({ type }),
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error("Reconciliation failed");
}
try {
  await db.query("SET ROLE nubra_runtime");
  const expired = (await db.query("SELECT nubra_expire_trials() AS count"))
    .rows[0].count;
  console.log(`Expired trials: ${expired}`);
  if (
    process.env.BILLING_ENABLED === "true" &&
    process.env.MP_ACCESS_TOKEN &&
    process.env.MP_WEBHOOK_SECRET &&
    process.env.MP_COLLECTOR_ID
  ) {
    const agreements = (
      await db.query(
        "SELECT provider_id FROM billing_agreements WHERE provider_id IS NOT NULL AND status<>'CANCELLED' ORDER BY updated_at LIMIT 100",
      )
    ).rows;
    for (const agreement of agreements) {
      try {
        await reconcile(agreement.provider_id, "subscription_preapproval");
        const invoices = await provider(
          "/authorized_payments/search?preapproval_id=" +
            encodeURIComponent(agreement.provider_id) +
            "&limit=100",
        );
        for (const invoice of invoices.results ?? [])
          if (invoice.payment?.id)
            await reconcile(invoice.id, "subscription_authorized_payment");
      } catch {
        failures++;
      }
    }
    console.log(
      `Checked recurring agreements: ${agreements.length}; failures: ${failures}`,
    );
  }
  if (failures) process.exitCode = 1;
} finally {
  await db.end();
}
