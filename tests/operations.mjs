import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import pg from "pg";
import nextEnv from "@next/env";
import { chromium, expect } from "@playwright/test";
nextEnv.loadEnvConfig(process.cwd());
const base = process.env.TEST_BASE_URL ?? "http://localhost:3100";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const orgs = [],
  users = [],
  adminHashes = [];
let checks = 0,
  browser;
async function call(path, { method = "GET", cookie, body, status = 200 } = {}) {
  const r = await fetch(base + path, {
    method,
    redirect: "manual",
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  assert.equal(r.status, status, `${method} ${path}: ${r.status}`);
  checks++;
  const raw = await r.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = raw;
  }
  return { data, cookie: r.headers.get("set-cookie")?.split(";")[0] };
}
async function login(email, password) {
  return (
    await call("/api/auth/login", { method: "POST", body: { email, password } })
  ).cookie;
}
try {
  const admin = await call("/api/admin/login", {
    method: "POST",
    body: {
      username: process.env.ADMIN_USERNAME,
      password: process.env.ADMIN_PASSWORD,
    },
  });
  adminHashes.push(
    createHash("sha256").update(admin.cookie.split("=")[1]).digest("hex"),
  );
  const password = randomBytes(20).toString("hex");
  const owners = [];
  const emails = [];
  for (const label of ["A", "B"]) {
    const email = `operations-${randomUUID()}@example.invalid`;
    emails.push(email);
    const result = await call("/api/admin/organizations", {
      method: "POST",
      cookie: admin.cookie,
      body: {
        name: `Operations ${label}`,
        ownerName: `Owner ${label}`,
        ownerEmail: email,
        ownerPassword: password,
      },
      status: 201,
    });
    orgs.push(result.data.organization.id);
    await call(
      "/api/internal/admin/organizations/" + result.data.organization.id,
      {
        method: "POST",
        cookie: admin.cookie,
        body: {
          action: "plan",
          subscription: {
            plan: "BUSINESS",
            source: "MANUAL_GRANT",
            reason: "Operations test team capacity",
          },
        },
      },
    );
    users.push(
      (await db.query("SELECT id FROM users WHERE email=$1", [email])).rows[0]
        .id,
    );
    owners.push(await login(email, password));
  }
  let [a, b] = owners;
  await call("/api/v1/finance", { status: 401 });
  await call("/api/v1/members", { status: 401 });
  const am = (await call("/api/v1/members", { cookie: a })).data[0];
  await call("/api/v1/members/" + am.id, {
    method: "DELETE",
    cookie: a,
    status: 409,
  });
  const bm = (await call("/api/v1/members", { cookie: b })).data[0];
  await call("/api/v1/members/" + bm.id, {
    method: "PATCH",
    cookie: a,
    body: { role: "SALES" },
    status: 404,
  });
  const employeeEmail = `employee-${randomUUID()}@example.invalid`;
  const employee = (
    await call(`/api/admin/organizations/${orgs[0]}/members`, {
      method: "POST",
      cookie: admin.cookie,
      body: { name: "Employee", email: employeeEmail, password, role: "SALES" },
      status: 201,
    })
  ).data.id;
  users.push(
    (await db.query("SELECT id FROM users WHERE email=$1", [employeeEmail]))
      .rows[0].id,
  );
  const salesCookie = await login(employeeEmail, password);
  await call("/api/v1/members", { cookie: salesCookie, status: 403 });
  await call("/api/v1/cash", {
    method: "POST",
    cookie: salesCookie,
    body: { action: "open", openingCents: 0 },
    status: 403,
  });
  await call("/api/v1/members/" + employee, {
    method: "PATCH",
    cookie: a,
    body: { role: "ADMINISTRATOR" },
  });
  await call("/api/v1/sales", { cookie: salesCookie, status: 401 });
  const employeeAdmin = await login(employeeEmail, password);
  await call("/api/v1/members/" + am.id, {
    method: "PATCH",
    cookie: employeeAdmin,
    body: { role: "SALES" },
    status: 403,
  });
  await call("/api/v1/members/" + employee, { method: "DELETE", cookie: a });
  await call("/api/v1/members", { cookie: employeeAdmin, status: 401 });
  // Use a real generated image for upload and actual OCR in the browser.
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 1000 },
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const displayDate = day.split("-").reverse().join("/");
  await page.setContent(
    `<main style="background:white;color:black;padding:55px;font:32px monospace;width:850px;height:650px"><h1>COMPROBANTE</h1><p>Factura 0001-00009999</p><p>Fecha ${displayDate}</p><p>Venta de productos</p><p>TOTAL $ 1.250,00</p></main>`,
  );
  const image = await page.locator("main").screenshot();
  const receipt = {
    image: image.toString("base64"),
    totalCents: 125000,
    reference: "0001-00009999",
    soldOn: day,
    description: "Comprobante de prueba",
    confirmed: true,
  };
  const imported = (
    await call("/api/v1/receipts", {
      method: "POST",
      cookie: a,
      body: receipt,
      status: 201,
    })
  ).data;
  const retry = (
    await call("/api/v1/receipts", {
      method: "POST",
      cookie: a,
      body: receipt,
      status: 201,
    })
  ).data;
  assert.equal(imported.id, retry.id);
  assert.equal(retry.duplicate, true);
  checks += 2;
  await call("/api/v1/receipts/" + imported.id, { cookie: b, status: 404 });
  const other = (
    await call("/api/v1/receipts", {
      method: "POST",
      cookie: b,
      body: receipt,
      status: 201,
    })
  ).data;
  assert.notEqual(other.id, imported.id);
  checks++;
  await call("/api/v1/receipts", {
    method: "POST",
    cookie: a,
    body: { ...receipt, confirmed: false },
    status: 400,
  });
  const pay = {
    saleId: imported.id,
    amountCents: 10000,
    method: "CASH",
    reference: "Partial",
    idempotencyKey: randomUUID(),
  };
  await call("/api/v1/payments", {
    method: "POST",
    cookie: b,
    body: pay,
    status: 404,
  });
  await call("/api/v1/payments", {
    method: "POST",
    cookie: a,
    body: pay,
    status: 409,
  });
  const cash = (
    await call("/api/v1/cash", {
      method: "POST",
      cookie: a,
      body: { action: "open", openingCents: 5000 },
    })
  ).data.id;
  await call("/api/v1/cash", {
    method: "POST",
    cookie: a,
    body: { action: "open", openingCents: 0 },
    status: 409,
  });
  const payments = await Promise.all(
    [1, 2].map(() =>
      call("/api/v1/payments", { method: "POST", cookie: a, body: pay }),
    ),
  );
  assert.equal(payments[0].data.id, payments[1].data.id);
  checks++;
  await call("/api/v1/payments", {
    method: "POST",
    cookie: a,
    body: { ...pay, amountCents: 11000 },
    status: 409,
  });
  const summary = (await call("/api/v1/finance", { cookie: a })).data;
  assert.equal(summary.sales[0].balance_cents, "115000");
  assert.equal(summary.cash[0].balance_cents, "15000");
  checks += 2;
  await call("/api/v1/cash", {
    method: "POST",
    cookie: b,
    body: { action: "close", sessionId: cash, countedCents: 0 },
    status: 404,
  });
  await call("/api/v1/cash", {
    method: "POST",
    cookie: a,
    body: {
      action: "movement",
      sessionId: cash,
      amountCents: -15001,
      reason: "Invalid",
      idempotencyKey: randomUUID(),
    },
    status: 409,
  });
  const concurrent = await Promise.all(
    [1, 2].map(() =>
      fetch(base + "/api/v1/payments", {
        method: "POST",
        headers: { cookie: a, "Content-Type": "application/json" },
        body: JSON.stringify({
          ...pay,
          method: "TRANSFER",
          amountCents: 115000,
          idempotencyKey: randomUUID(),
        }),
      }),
    ),
  );
  assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
  checks++;
  await call("/api/v1/cash", {
    method: "POST",
    cookie: a,
    body: { action: "close", sessionId: cash, countedCents: 14000 },
  });
  const closed = (await call("/api/v1/finance", { cookie: a })).data.cash[0];
  assert.equal(closed.expected_cents, "15000");
  assert.equal(closed.counted_cents, "14000");
  checks += 2;
  // Admin company controls and session revocation.
  await call(`/api/admin/organizations/${orgs[1]}`, {
    method: "PUT",
    cookie: a,
    body: {},
    status: 401,
  });
  const orgBody = {
    name: "Updated B",
    timezone: "America/Argentina/Buenos_Aires",
    currency: "ARS",
    active: false,
  };
  await call(`/api/admin/organizations/${orgs[1]}`, {
    method: "PUT",
    cookie: admin.cookie,
    body: orgBody,
  });
  await call("/api/v1/sales", { cookie: b, status: 401 });
  const suspendedLogin = await call("/api/auth/login", {
    method: "POST",
    body: { email: emails[1], password },
  });
  await call("/api/v1/sales", { cookie: suspendedLogin.cookie, status: 401 });
  await call(`/api/admin/organizations/${orgs[1]}`, {
    method: "PUT",
    cookie: admin.cookie,
    body: { ...orgBody, active: true },
  });
  b = await login(emails[1], password);
  // The isolated suite delivers only to its local SMTP sink.
  await call("/api/auth/forgot-password", {
    method: "POST",
    body: { email: emails[1] },
    status: process.env.MAIL_ENABLED === "true" ? 200 : 503,
  });
  const token = randomBytes(32).toString("hex");
  await db.query(
    "INSERT INTO password_reset_tokens(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,NOW()+INTERVAL '30 minutes')",
    [randomUUID(), users[1], createHash("sha256").update(token).digest("hex")],
  );
  const expiredToken = randomBytes(32).toString("hex");
  await db.query(
    "INSERT INTO password_reset_tokens(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,NOW()-INTERVAL '1 second')",
    [
      randomUUID(),
      users[1],
      createHash("sha256").update(expiredToken).digest("hex"),
    ],
  );
  const replacement = randomBytes(24).toString("hex");
  await call("/api/auth/reset-password", {
    method: "POST",
    body: { token: expiredToken, password: replacement },
    status: 400,
  });
  await call("/api/auth/reset-password", {
    method: "POST",
    body: { token, password: replacement },
  });
  await call("/api/auth/reset-password", {
    method: "POST",
    body: { token, password: replacement },
    status: 400,
  });
  await call("/api/v1/sales", { cookie: b, status: 401 });
  await login(emails[1], replacement);
  // Actual OCR: photo -> detected amount/reference -> review -> save. Use B to avoid A duplicate.
  await page.goto(base + "/login");
  await page.getByLabel("Email", { exact: true }).fill(emails[1]);
  await page.getByLabel("Contraseña", { exact: true }).fill(replacement);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Todo listo/ })).toBeVisible();
  await page.getByRole("button", { name: "Nueva venta", exact: true }).click();
  await page.getByRole("button", { name: "Sacar foto o subir boleta" }).click();
  await page.getByLabel("Subir boleta", { exact: true }).setInputFiles({
    name: "receipt.png",
    mimeType: "image/png",
    buffer: image,
  });
  await expect(
    page.getByLabel("Total de la venta", { exact: true }),
  ).toHaveValue("1250.00", { timeout: 120000 });
  await expect(page.getByLabel("Referencia única del comprobante")).toHaveValue(
    "0001-00009999",
  );
  await page
    .getByLabel("Referencia única del comprobante")
    .fill("BROWSER-RECEIPT-0002");
  await page.getByLabel("Fecha de la venta", { exact: true }).fill(day);
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Registrar venta del comprobante" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  checks++;
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  await nav.getByRole("button", { name: "Pagos y caja", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Pagos y caja", exact: true }),
  ).toBeVisible();
  await nav
    .getByRole("button", { name: "Equipo y roles", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Equipo y roles", exact: true }),
  ).toBeVisible();
  await page.goto(base + "/admin");
  await page
    .getByLabel("Usuario", { exact: true })
    .fill(process.env.ADMIN_USERNAME);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(process.env.ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await page.getByLabel("Buscar empresas").fill("Updated B");
  await page.getByRole("button", { name: "Gestionar", exact: true }).click();
  await expect(page.getByLabel("Nombre del negocio")).toHaveValue("Updated B");
  await page
    .getByRole("button", { name: "Usuarios y roles", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Equipo y roles", exact: true }),
  ).toBeVisible();
  assert.deepEqual(pageErrors, []);
  checks++;
  // Track the UI-created admin session for cleanup, without exposing it.
  for (const c of await context.cookies())
    if (c.name === "nubra_admin_session")
      adminHashes.push(createHash("sha256").update(c.value).digest("hex"));
  console.log(
    `PASS: ${checks} operations assertions, reset-token lifecycle and actual browser OCR, finance, team and admin flows.`,
  );
} finally {
  if (browser) await browser.close();
  for (const table of [
    "cash_movements",
    "payments",
    "cash_sessions",
    "receipt_imports",
    "customer_activities",
    "quote_items",
    "quotes",
    "inventory_movements",
    "sale_items",
    "sales",
    "products",
    "customers",
    "audit_logs",
  ])
    await db.query(
      `DELETE FROM ${table} WHERE organization_id=ANY($1::uuid[])`,
      [orgs],
    );
  await db.query("DELETE FROM organizations WHERE id=ANY($1::uuid[])", [orgs]);
  await db.query("DELETE FROM users WHERE id=ANY($1::uuid[])", [users]);
  await db.query("DELETE FROM sessions WHERE token_hash=ANY($1::text[])", [
    adminHashes,
  ]);
  await db.end();
}
