import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHmac } from "node:crypto";
import pg from "pg";
import { chromium, expect } from "@playwright/test";
if (!globalThis.__nubraTestPayments) throw new Error("Use isolated harness");
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL }),
  base = process.env.TEST_BASE_URL;
let checks = 0,
  browser;
async function call(
  path,
  { method = "GET", body, cookie, status = 200, headers = {} } = {},
) {
  const r = await fetch(base + path, {
    method,
    redirect: "manual",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await r.text();
  assert.equal(
    r.status,
    status,
    `${method} ${path}: ${r.status} ${raw.slice(0, 180)}`,
  );
  checks++;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = raw;
  }
  return { data, cookie: r.headers.get("set-cookie")?.split(";")[0] };
}
const password = randomBytes(20).toString("hex");
const login = async (email) =>
  (await call("/api/auth/login", { method: "POST", body: { email, password } }))
    .cookie;
try {
  const admin = (
    await call("/api/admin/login", {
      method: "POST",
      body: {
        username: process.env.ADMIN_USERNAME,
        password: process.env.ADMIN_PASSWORD,
      },
    })
  ).cookie;
  const owners = [];
  for (let i = 0; i < 2; i++) {
    const email = `role-owner-${randomUUID()}@example.invalid`;
    const result = await call("/api/admin/organizations", {
      method: "POST",
      cookie: admin,
      status: 201,
      body: {
        name: "Roles y pagos " + i,
        ownerName: "Responsable",
        ownerEmail: email,
        ownerPassword: password,
      },
    });
    owners.push({
      id: result.data.organization.id,
      cookie: await login(email),
      email,
    });
  }
  const [a, b] = owners;
  const roleBody = {
    name: "Mostrador",
    description: "Lectura de clientes",
    permissions: ["customers.read"],
  };
  const role = (
    await call("/api/v1/roles", {
      method: "POST",
      cookie: a.cookie,
      status: 201,
      body: roleBody,
    })
  ).data.id;
  await call("/api/v1/roles", {
    method: "POST",
    cookie: b.cookie,
    status: 201,
    body: roleBody,
  });
  assert(
    !(await call("/api/v1/roles", { cookie: b.cookie })).data.roles.some(
      (r) => r.id === role,
    ),
  );
  checks++;
  await call("/api/v1/roles/" + role, {
    method: "PUT",
    cookie: b.cookie,
    body: roleBody,
    status: 404,
  });
  await call("/api/v1/roles/" + role, {
    method: "DELETE",
    cookie: b.cookie,
    status: 404,
  });
  await call("/api/v1/roles", {
    method: "POST",
    cookie: a.cookie,
    body: {
      ...roleBody,
      name: "Escalada",
      permissions: ["members.read", "members.write"],
    },
    status: 403,
  });
  await call("/api/v1/roles", {
    method: "POST",
    cookie: a.cookie,
    body: { ...roleBody, permissions: ["customers.write"] },
    status: 400,
  });
  await call("/api/v1/roles", {
    method: "POST",
    cookie: a.cookie,
    body: { ...roleBody, permissions: ["unknown.read"] },
    status: 400,
  });
  // Price comes from the server, never from client-supplied amount.
  const price = {
    plan: "LITE",
    priceCents: 150000,
    currency: "ARS",
    enabled: true,
  };
  await call("/api/internal/admin/prices", {
    method: "PATCH",
    cookie: a.cookie,
    body: price,
    status: 401,
  });
  await call("/api/internal/admin/prices", {
    method: "PATCH",
    cookie: admin,
    body: { ...price, priceCents: null },
    status: 400,
  });
  await call("/api/v1/billing/checkout", {
    method: "POST",
    cookie: a.cookie,
    body: { plan: "LITE", idempotencyKey: randomUUID() },
    status: 409,
  });
  await call("/api/internal/admin/prices", {
    method: "PATCH",
    cookie: admin,
    body: price,
  });
  const key = randomUUID();
  await call("/api/v1/billing/checkout", {
    method: "POST",
    cookie: a.cookie,
    body: { plan: "LITE", idempotencyKey: key, amount: 1 },
    status: 400,
  });
  const order = (
    await call("/api/v1/billing/checkout", {
      method: "POST",
      cookie: a.cookie,
      body: { plan: "LITE", idempotencyKey: key },
    })
  ).data;
  assert.equal(
    globalThis.__nubraTestPreferences.at(-1).items[0].unit_price,
    1500,
  );
  checks++;
  const count = globalThis.__nubraTestPreferences.length;
  const again = (
    await call("/api/v1/billing/checkout", {
      method: "POST",
      cookie: a.cookie,
      body: { plan: "LITE", idempotencyKey: key },
    })
  ).data;
  assert.equal(again.id, order.id);
  assert.equal(globalThis.__nubraTestPreferences.length, count);
  checks += 2;
  await call("/api/v1/billing/checkout", {
    method: "POST",
    cookie: a.cookie,
    body: { plan: "LITE", idempotencyKey: randomUUID() },
    status: 409,
  });
  assert.equal(
    (await call("/api/v1/billing/history", { cookie: b.cookie })).data.length,
    0,
  );
  checks++;
  await call("/settings/subscription?status=approved&order=" + order.id, {
    cookie: a.cookie,
  });
  assert.equal(
    (await call("/api/v1/subscription", { cookie: a.cookie })).data.subscription
      .code,
    "FREE",
  );
  checks++;
  const payment = {
    id: "123789",
    status: "approved",
    external_reference: order.id,
    transaction_amount: 1500,
    currency_id: "ARS",
    collector_id: process.env.MP_COLLECTOR_ID,
    live_mode: false,
    transaction_amount_refunded: 0,
  };
  async function webhook(p, options = {}) {
    globalThis.__nubraTestPayments.set(p.id, p);
    const ts = String(Date.now()),
      requestId = randomUUID();
    const v1 = createHmac("sha256", process.env.MP_WEBHOOK_SECRET)
      .update(`id:${p.id};request-id:${requestId};ts:${ts};`)
      .digest("hex");
    return call("/api/billing/mercadopago/webhook?data.id=" + p.id, {
      method: "POST",
      body: { data: { id: "untrusted-body" } },
      headers: {
        "x-request-id": requestId,
        "x-signature": `ts=${ts},v1=${v1}`,
      },
      ...options,
    });
  }
  await webhook(payment, {
    headers: { "x-signature": "invalid" },
    status: 401,
  });
  await webhook({ ...payment, collector_id: "999" }, { status: 400 });
  await webhook({ ...payment, transaction_amount: 1 }, { status: 400 });
  await webhook({ ...payment, live_mode: true }, { status: 400 });
  await webhook(payment);
  const sub = (await call("/api/v1/subscription", { cookie: a.cookie })).data
    .subscription;
  assert.equal(sub.code, "LITE");
  assert.equal(sub.source, "DIRECT_PURCHASE");
  checks += 2;
  await webhook(payment);
  assert.equal(
    (await call("/api/v1/subscription", { cookie: a.cookie })).data.subscription
      .expires_at,
    sub.expires_at,
  );
  checks++;
  await call("/api/v1/billing/checkout", {
    method: "POST",
    cookie: a.cookie,
    body: { plan: "LITE", idempotencyKey: key },
    status: 409,
  });
  // Role assignment and live revocation.
  const email = `role-member-${randomUUID()}@example.invalid`;
  const member = (
    await call(`/api/admin/organizations/${a.id}/members`, {
      method: "POST",
      cookie: admin,
      status: 201,
      body: { name: "Integrante", email, password, role: "VIEWER" },
    })
  ).data.id;
  await call("/api/v1/members/" + member, {
    method: "PATCH",
    cookie: b.cookie,
    body: { role: "CUSTOM", customRoleId: role },
    status: 404,
  });
  const foreign = (await call("/api/v1/roles", { cookie: b.cookie })).data
    .roles[0].id;
  await call("/api/v1/members/" + member, {
    method: "PATCH",
    cookie: a.cookie,
    body: { role: "CUSTOM", customRoleId: foreign },
    status: 404,
  });
  await call("/api/v1/members/" + member, {
    method: "PATCH",
    cookie: a.cookie,
    body: { role: "CUSTOM", customRoleId: role },
  });
  const custom = await login(email);
  await call("/api/v1/customers", { cookie: custom });
  await call("/api/v1/products", { cookie: custom, status: 403 });
  await call("/api/v1/customers", {
    method: "POST",
    cookie: custom,
    body: { name: "Denied" },
    status: 403,
  });
  await call("/api/v1/roles", { cookie: custom, status: 403 });
  await call("/api/v1/billing/history", { cookie: custom, status: 403 });
  await call("/api/v1/billing/checkout", {
    method: "POST",
    cookie: custom,
    body: { plan: "LITE", idempotencyKey: randomUUID() },
    status: 403,
  });
  await call("/api/v1/roles/" + role, {
    method: "DELETE",
    cookie: a.cookie,
    status: 409,
  });
  await call("/api/v1/roles/" + role, {
    method: "PUT",
    cookie: a.cookie,
    body: { ...roleBody, permissions: ["customers.read", "customers.write"] },
  });
  await call("/api/v1/customers", {
    method: "POST",
    cookie: custom,
    body: { name: "Allowed" },
    status: 201,
  });
  await call("/api/v1/roles/" + role, {
    method: "PUT",
    cookie: a.cookie,
    body: { ...roleBody, permissions: [] },
  });
  await call("/api/v1/customers", { cookie: custom, status: 403 });
  // Invite a verified account; wrong identity cannot accept, replay rejected.
  const invited = `invited-${randomUUID()}@example.invalid`;
  await call("/api/auth/register", {
    method: "POST",
    status: 201,
    body: { name: "Invitado", email: invited, password },
  });
  const verification = globalThis.__nubraTestMail
    .find((m) => m.recipient.includes(invited))
    .raw.match(/#token=([a-f0-9]{64})/)[1];
  await call("/api/auth/verify-email", {
    method: "POST",
    body: { token: verification },
  });
  const inviteId = (
    await call("/api/v1/invitations", {
      method: "POST",
      cookie: a.cookie,
      status: 201,
      body: { email: invited, role: "CUSTOM", customRoleId: role },
    })
  ).data.id;
  await call("/api/v1/invitations/" + inviteId, {
    method: "DELETE",
    cookie: b.cookie,
    status: 404,
  });
  const token = globalThis.__nubraTestMail
    .filter((m) => m.recipient.includes(invited))
    .at(-1)
    .raw.match(/#token=([a-f0-9]{64})/)[1];
  await call("/api/auth/accept-invitation", {
    method: "POST",
    cookie: b.cookie,
    body: { token },
    status: 400,
  });
  const inviteCookie = await login(invited);
  await call("/api/auth/accept-invitation", {
    method: "POST",
    cookie: inviteCookie,
    body: { token },
  });
  await call("/api/auth/accept-invitation", {
    method: "POST",
    cookie: inviteCookie,
    body: { token },
    status: 400,
  });
  const invitedMember = (
    await call("/api/v1/members", { cookie: a.cookie })
  ).data.find((m) => m.email === invited);
  assert.equal(invitedMember.custom_role_id, role);
  checks++;
  // Browser navigation and actual CSS delivery, desktop and mobile.
  browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge",
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const failed = [];
  page.on("response", (r) => {
    if (r.status() >= 400 && /\.(css|js)(\?|$)/.test(r.url()))
      failed.push(r.url());
  });
  for (const route of ["/admin", "/register-business", "/plans"]) {
    await page.goto(base + route);
    await page.waitForLoadState("networkidle");
    assert.notEqual(
      await page
        .locator("body")
        .evaluate((e) => getComputedStyle(e).fontFamily),
      '"Times New Roman"',
    );
    checks++;
    await page.screenshot({
      path: `.next/test-${route.slice(1)}.png`,
      fullPage: true,
    });
  }
  await context.addCookies([
    { name: a.cookie.split("=")[0], value: a.cookie.split("=")[1], url: base },
  ]);
  await page.goto(base);
  await page
    .getByRole("button", { name: "Equipo y roles", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Crear rol", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Crear rol", exact: true }).click();
  await page.getByLabel("Nombre del rol").fill("Depósito");
  await page.getByLabel("Ver Inventario", { exact: true }).check();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Guardar rol", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Depósito", exact: true }),
  ).toBeVisible();
  checks++;
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: ".next/test-team.png", fullPage: true });
  await page
    .getByRole("link", { name: "Planes y suscripción", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Historial de pagos" }),
  ).toBeVisible();
  await page.screenshot({
    path: ".next/test-subscription.png",
    fullPage: true,
  });
  checks++;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/plans");
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  checks++;
  await page.screenshot({
    path: ".next/test-plans-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(failed, []);
  checks++;
  await webhook({
    ...payment,
    status: "refunded",
    transaction_amount_refunded: 1500,
  });
  assert.equal(
    (await call("/api/v1/subscription", { cookie: a.cookie })).data.subscription
      .code,
    "FREE",
  );
  checks++;
  await webhook(payment);
  assert.equal(
    (await call("/api/v1/subscription", { cookie: a.cookie })).data.subscription
      .code,
    "FREE",
  );
  checks++;
  console.log(
    `PASS: ${checks} roles, invitation, Mercado Pago and visual checks (local provider fixture; no charges).`,
  );
} finally {
  await browser?.close();
  await db.end();
}
