import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import pg from "pg";
import { hash } from "argon2";
import { chromium, expect } from "@playwright/test";
import { fixtureMember } from "./fixtures.mjs";
if (!globalThis.__nubraTestAgreements) throw new Error("Use isolated harness");
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL }),
  base = process.env.TEST_BASE_URL;
let checks = 0,
  browser;
async function call(
  path,
  { method = "GET", body, cookie, status = 200, headers = {} } = {},
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  assert.equal(
    response.status,
    status,
    `${method} ${path}: ${JSON.stringify(data)}`,
  );
  checks++;
  return { data, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
const password = randomBytes(20).toString("hex");
async function login(email) {
  return (
    await call("/api/auth/login", { method: "POST", body: { email, password } })
  ).cookie;
}
async function hook(id, type, expected = 200, valid = true) {
  const ts = String(Date.now()),
    requestId = randomUUID();
  const signature = createHmac("sha256", process.env.MP_WEBHOOK_SECRET)
    .update(`id:${id.toLowerCase()};request-id:${requestId};ts:${ts};`)
    .digest("hex");
  return call("/api/billing/mercadopago/webhook?data.id=" + id, {
    method: "POST",
    body: { type, data: { id } },
    headers: {
      "x-request-id": requestId,
      "x-signature": `ts=${ts},v1=${valid ? signature : "0".repeat(64)}`,
    },
    status: expected,
  });
}
try {
  // This suite gets its own administrator so its logins do not consume the
  // shared administrator's rate limit used by the remaining browser suites.
  const staffName = "trial-admin-" + randomUUID();
  await db.query(
    "INSERT INTO staff_users(id,username,password_hash,role) VALUES($1,$2,$3,'SUPER_ADMIN')",
    [randomUUID(), staffName, await hash(password)],
  );
  const admin = (
    await call("/api/admin/login", {
      method: "POST",
      body: {
        username: staffName,
        password,
      },
    })
  ).cookie;
  const owners = [];
  for (let i = 0; i < 3; i++) {
    const email = `trial-${randomUUID()}@example.invalid`;
    const r = await call("/api/admin/organizations", {
      method: "POST",
      cookie: admin,
      status: 201,
      body: {
        name: "Prueba y recurrencia " + i,
        ownerName: "Responsable",
        ownerEmail: email,
        ownerPassword: password,
      },
    });
    owners.push({
      id: r.data.organization.id,
      cookie: await login(email),
      email,
    });
  }
  const [a, b, c] = owners;
  const viewerEmail = `viewer-${randomUUID()}@example.invalid`;
  await fixtureMember(db, a.id, {
    body: { name: "Consulta", email: viewerEmail, password, role: "VIEWER" },
  });
  const viewer = await login(viewerEmail);
  await call("/api/v1/subscription/trial", {
    method: "POST",
    body: {},
    status: 401,
  });
  await call("/api/v1/subscription/trial", {
    method: "POST",
    cookie: viewer,
    body: {},
    status: 403,
  });
  const claims = await Promise.all(
    [1, 2].map(() =>
      fetch(base + "/api/v1/subscription/trial", {
        method: "POST",
        headers: { cookie: a.cookie },
      }),
    ),
  );
  assert.deepEqual(claims.map((r) => r.status).sort(), [200, 409]);
  checks++;
  const active = (await call("/api/v1/subscription", { cookie: a.cookie }))
    .data;
  assert.equal(active.subscription.code, "BUSINESS");
  assert.equal(active.subscription.source, "BUSINESS_TRIAL");
  assert.equal(
    new Date(active.subscription.trial_ends_at) -
      new Date(active.subscription.trial_claimed_at),
    14 * 86400000,
  );
  checks += 3;
  await db.query(
    "UPDATE subscriptions SET trial_ends_at=NOW()-INTERVAL '1 second',expires_at=NOW()-INTERVAL '1 second' WHERE organization_id=$1",
    [a.id],
  );
  const expired = (await call("/api/v1/subscription", { cookie: a.cookie }))
    .data;
  assert.equal(expired.subscription.code, "FREE");
  assert.equal(
    expired.entitlements.find((e) => e.key === "customers").limit_value,
    30,
  );
  checks += 2;
  await call("/api/v1/subscription/trial", {
    method: "POST",
    cookie: a.cookie,
    body: {},
    status: 409,
  });
  await call("/api/internal/admin/prices", {
    method: "PATCH",
    cookie: admin,
    body: {
      plan: "BUSINESS",
      period: "MONTHLY",
      priceCents: 1000000,
      currency: "ARS",
      enabled: true,
    },
  });
  const consent = {
    plan: "BUSINESS",
    idempotencyKey: randomUUID(),
    automaticRenewal: true,
  };
  await call("/api/v1/billing/recurring", {
    method: "POST",
    cookie: a.cookie,
    body: { ...consent, automaticRenewal: false },
    status: 400,
  });
  await call("/api/v1/billing/recurring", {
    method: "POST",
    cookie: a.cookie,
    body: { ...consent, amount: 1 },
    status: 400,
  });
  await call("/api/v1/billing/recurring", {
    method: "POST",
    cookie: viewer,
    body: consent,
    status: 403,
  });
  await call("/api/v1/billing/checkout", {
    method: "POST",
    cookie: a.cookie,
    body: { plan: "BUSINESS", period: "MONTHLY", idempotencyKey: randomUUID() },
    status: 409,
  });
  const created = (
    await call("/api/v1/billing/recurring", {
      method: "POST",
      cookie: a.cookie,
      body: consent,
    })
  ).data;
  const count = globalThis.__nubraTestAgreements.size;
  assert.equal(
    (
      await call("/api/v1/billing/recurring", {
        method: "POST",
        cookie: a.cookie,
        body: consent,
      })
    ).data.id,
    created.id,
  );
  assert.equal(globalThis.__nubraTestAgreements.size, count);
  checks += 2;
  await call("/api/v1/billing/recurring", {
    method: "POST",
    cookie: a.cookie,
    body: { ...consent, idempotencyKey: randomUUID() },
    status: 409,
  });
  await call("/api/v1/billing/checkout", {
    method: "POST",
    cookie: a.cookie,
    body: { plan: "LITE", period: "YEARLY", idempotencyKey: randomUUID() },
    status: 409,
  });
  await call("/api/v1/billing/recurring", {
    method: "PATCH",
    cookie: b.cookie,
    body: { id: created.id, action: "cancel" },
    status: 404,
  });
  const agreement = [...globalThis.__nubraTestAgreements.values()].find(
    (x) => x.external_reference === created.id,
  );
  assert.equal(agreement.auto_recurring.frequency, 1);
  assert.equal(agreement.auto_recurring.frequency_type, "months");
  assert.equal(agreement.auto_recurring.transaction_amount, 10000);
  checks += 3;
  agreement.status = "authorized";
  await hook(agreement.id, "subscription_preapproval", 401, false);
  await hook(agreement.id, "subscription_preapproval");
  assert.equal(
    (await call("/api/v1/subscription", { cookie: a.cookie })).data.subscription
      .code,
    "FREE",
  );
  checks++;
  function invoice(invoiceId, paymentId) {
    globalThis.__nubraTestInvoices.set(invoiceId, {
      id: invoiceId,
      preapproval_id: agreement.id,
      external_reference: created.id,
      transaction_amount: 10000,
      currency_id: "ARS",
      payment: { id: paymentId, status: "approved" },
    });
    globalThis.__nubraTestPayments.set(paymentId, {
      id: paymentId,
      status: "approved",
      external_reference: created.id,
      transaction_amount: 10000,
      currency_id: "ARS",
      collector_id: process.env.MP_COLLECTOR_ID,
      live_mode: false,
      transaction_amount_refunded: 0,
    });
  }
  invoice("70001", "80001");
  globalThis.__nubraTestPayments.get("80001").transaction_amount = 1;
  await hook("70001", "subscription_authorized_payment", 400);
  globalThis.__nubraTestPayments.get("80001").transaction_amount = 10000;
  await hook("70001", "subscription_authorized_payment");
  const paid = (await call("/api/v1/subscription", { cookie: a.cookie })).data;
  assert.equal(paid.subscription.code, "BUSINESS");
  assert(
    new Date(paid.subscription.expires_at) >
      new Date(Date.now() + 27 * 86400000),
  );
  checks += 2;
  await hook("70001", "subscription_authorized_payment");
  assert.equal(
    (await call("/api/v1/subscription", { cookie: a.cookie })).data.subscription
      .expires_at,
    paid.subscription.expires_at,
  );
  checks++;
  invoice("70002", "80002");
  await hook("70002", "subscription_authorized_payment");
  const renewed = (await call("/api/v1/subscription", { cookie: a.cookie }))
    .data;
  assert(
    new Date(renewed.subscription.expires_at) >
      new Date(
        new Date(paid.subscription.expires_at).getTime() + 27 * 86400000,
      ),
  );
  checks++;
  await call("/api/v1/billing/recurring", {
    method: "PATCH",
    cookie: a.cookie,
    body: { id: created.id, action: "cancel" },
  });
  assert.equal(agreement.status, "cancelled");
  checks++;
  agreement.status = "authorized";
  await hook(agreement.id, "subscription_preapproval");
  agreement.status = "cancelled";
  const cancelled = (await call("/api/v1/subscription", { cookie: a.cookie }))
    .data;
  assert.equal(cancelled.recurring.status, "CANCELLED");
  assert.equal(
    cancelled.subscription.expires_at,
    renewed.subscription.expires_at,
  );
  checks += 2;
  await call("/api/v1/billing/recurring", {
    method: "PATCH",
    cookie: a.cookie,
    body: { id: created.id, action: "cancel" },
  });
  globalThis.__nubraTestPayments.get("80002").status = "refunded";
  globalThis.__nubraTestPayments.get("80002").transaction_amount_refunded =
    10000;
  await hook("80002", "payment");
  assert.equal(
    (await call("/api/v1/subscription", { cookie: a.cookie })).data.subscription
      .code,
    "FREE",
  );
  checks++;
  // Browser claim, visible expiry, official logo, interactive landing and reduced motion.
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await context.addCookies([
    { name: "nubra_user_session", value: c.cookie.split("=")[1], url: base },
  ]);
  await page.goto(base + "/settings/subscription");
  await page
    .getByRole("button", { name: "Reclamar prueba gratis", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Activar mis 14 días gratis", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Tu prueba de Business está activa" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reclamar prueba gratis", exact: true }),
  ).toHaveCount(0);
  checks += 2;
  const second = (
    await call("/api/v1/billing/recurring", {
      method: "POST",
      cookie: c.cookie,
      body: { ...consent, idempotencyKey: randomUUID() },
    })
  ).data;
  const remote2 = [...globalThis.__nubraTestAgreements.values()].find(
    (x) => x.external_reference === second.id,
  );
  remote2.status = "authorized";
  globalThis.__nubraTestInvoices.set("70003", {
    id: "70003",
    preapproval_id: remote2.id,
    external_reference: second.id,
    transaction_amount: 10000,
    currency_id: "ARS",
    payment: { id: "80003", status: "approved" },
  });
  globalThis.__nubraTestPayments.set("80003", {
    ...globalThis.__nubraTestPayments.get("80001"),
    id: "80003",
    external_reference: second.id,
  });
  await hook("70003", "subscription_authorized_payment");
  await db.query(
    "UPDATE subscriptions SET trial_ends_at=NOW()-INTERVAL '1 second' WHERE organization_id=$1",
    [c.id],
  );
  assert.equal(
    (await call("/api/v1/subscription", { cookie: c.cookie })).data.subscription
      .source,
    "DIRECT_PURCHASE",
  );
  checks++;
  await context.clearCookies();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 950 });
    await page.goto(base, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Vendé", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "De la consulta a la venta" }),
    ).toBeVisible();
    assert(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    checks += 2;
    await page.screenshot({
      path: `.local/qa/landing-trial-${width}.png`,
      fullPage: true,
    });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(base);
  assert.equal(
    await page
      .locator('[class*="tourPanel"]')
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  checks++;
  await page.goto(base + "/forgot-password");
  await expect(page.getByRole("img", { name: "Nubra Negocios" })).toBeVisible();
  checks++;
  assert.deepEqual(errors, []);
  checks++;
  console.log(
    `PASS: ${checks} trial/recurring checks: concurrent claim, expiry, consent, isolation, duplicate invoices, renewals, cancellation, browser and reduced motion.`,
  );
} finally {
  await browser?.close();
  await db.end();
}
