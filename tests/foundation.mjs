import { fixtureMember } from "./fixtures.mjs";
import assert from "node:assert/strict";
import { randomUUID, randomBytes, scryptSync } from "node:crypto";
import { chromium, expect } from "@playwright/test";
import pg from "pg";
if (!globalThis.__nubraTestMail)
  throw new Error("Run with tests/run-suite.mjs");
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
  return {
    data,
    cookie: r.headers.get("set-cookie")?.split(";")[0],
    headers: r.headers,
  };
}
const password = randomBytes(20).toString("hex");
const business = {
  name: "Negocio de prueba",
  email: "business@example.invalid",
  sector: "Servicios",
  country: "Argentina",
  businessType: "PyME",
  responsibleName: "Responsable de prueba",
};
async function login(email) {
  return (
    await call("/api/auth/login", { method: "POST", body: { email, password } })
  ).cookie;
}
try {
  await call("/");
  await call("/privacy");
  await call("/terms");
  await call("/api/health");
  await call("/api/internal/admin/applications", { status: 401 });
  const admin = (
    await call("/api/admin/login", {
      method: "POST",
      body: {
        username: process.env.ADMIN_USERNAME,
        password: process.env.ADMIN_PASSWORD,
      },
    })
  ).cookie;
  const accounts = [];
  for (let i = 0; i < 2; i++) {
    const email = `foundation-${randomUUID()}@example.invalid`;
    const registered = await call("/api/auth/register", {
      method: "POST",
      body: { name: "Responsable", email, password },
      status: 201,
    });
    assert(!JSON.stringify(registered.data).includes("token"));
    checks++;
    const cookie = await login(email);
    await call("/api/v1/customers", { cookie, status: 401 });
    await call("/api/v1/application", {
      cookie,
      method: "POST",
      body: { business, requestedPlan: "BUSINESS", submit: true },
      status: 403,
    });
    const mail = globalThis.__nubraTestMail.find((m) =>
      m.recipient.includes(email),
    );
    assert(mail, "verification email delivered to local SMTP");
    checks++;
    const token = mail.raw.match(/#token=([a-f0-9]{64})/)[1];
    await call("/api/auth/verify-email", { method: "POST", body: { token } });
    await call("/api/auth/verify-email", {
      method: "POST",
      body: { token },
      status: 400,
    });
    const state = (await call("/api/v1/application", { cookie })).data;
    await call("/api/v1/application", {
      cookie,
      method: "POST",
      body: {
        business,
        requestedPlan: "BUSINESS",
        submit: true,
        legalVersionIds: [],
      },
      status: 400,
    });
    const payload = {
      business: { ...business, name: `Empresa ${i}` },
      requestedPlan: "BUSINESS",
      submit: true,
      legalVersionIds: state.documents.map((d) => d.id),
    };
    const app = (
      await call("/api/v1/application", {
        cookie,
        method: "POST",
        body: payload,
      })
    ).data;
    await call("/api/v1/customers", { cookie, status: 401 });
    await call(`/api/internal/admin/applications/${app.id}`, {
      cookie,
      method: "POST",
      body: { action: "approve" },
      status: 401,
    });
    if (i === 0) {
      await call(`/api/internal/admin/applications/${app.id}`, {
        cookie: admin,
        method: "POST",
        body: {
          action: "information",
          message: "Completá los datos del responsable",
        },
      });
      await call("/api/v1/application", {
        cookie,
        method: "POST",
        body: payload,
      });
    }
    const approvals = await Promise.all(
      [1, 2].map(() =>
        call(`/api/internal/admin/applications/${app.id}`, {
          cookie: admin,
          method: "POST",
          body: { action: "approve" },
        }),
      ),
    );
    assert.equal(approvals[0].data.id, approvals[1].data.id);
    checks++;
    const subscription = (await call("/api/v1/subscription", { cookie })).data;
    assert.equal(subscription.subscription.code, "FREE");
    assert.equal(
      subscription.entitlements.find((e) => e.key === "advanced_analytics")
        .enabled,
      false,
    );
    checks += 2;
    accounts.push({
      email,
      cookie,
      organizationId: approvals[0].data.id,
      appId: app.id,
    });
  }
  const [a, b] = accounts;
  const ca = (
    await call("/api/v1/customers", {
      cookie: a.cookie,
      method: "POST",
      body: { name: "Cliente A" },
      status: 201,
    })
  ).data.id;
  const cb = (
    await call("/api/v1/customers", {
      cookie: b.cookie,
      method: "POST",
      body: { name: "Cliente B secreto" },
      status: 201,
    })
  ).data.id;
  for (const method of ["GET", "PUT", "DELETE"])
    await call(`/api/v1/customers/${cb}`, {
      cookie: a.cookie,
      method,
      body: method === "PUT" ? { name: "Atacante" } : undefined,
      status: 404,
    });
  const exported = await call("/api/v1/exports/customers", {
    cookie: a.cookie,
    method: "POST",
    body: {},
  });
  assert(exported.data.includes("Cliente A"));
  assert(!exported.data.includes("secreto"));
  checks += 2;
  await call("/api/internal/admin/plans", {
    cookie: a.cookie,
    method: "PATCH",
    body: {},
    status: 401,
  });
  // Internal read-only identity is distinct from business users.
  const staffId = randomUUID(),
    salt = randomBytes(16).toString("hex");
  await db.query(
    "INSERT INTO staff_users(id,username,password_hash,role) VALUES($1,$2,$3,'READ_ONLY')",
    [
      staffId,
      "reader",
      `${salt}:${scryptSync(password, salt, 64).toString("hex")}`,
    ],
  );
  const reader = (
    await call("/api/admin/login", {
      method: "POST",
      body: { username: "reader", password },
    })
  ).cookie;
  await call(`/api/internal/admin/applications/${a.appId}`, {
    cookie: reader,
    method: "POST",
    body: { action: "approve" },
    status: 403,
  });
  await call("/api/v1/customers", { cookie: reader, status: 401 });
  const userId = (
    await db.query("SELECT id FROM users WHERE email=$1", [a.email])
  ).rows[0].id;
  const denied = await call(
    `/api/admin/organizations/${a.organizationId}/members`,
    {
      cookie: admin,
      method: "POST",
      body: {
        name: "Empleado",
        email: "cashier@example.invalid",
        password,
        role: "CASHIER",
      },
      status: 403,
    },
  );
  assert(denied.data.error);
  checks++;
  await call(`/api/internal/admin/organizations/${a.organizationId}`, {
    cookie: admin,
    method: "POST",
    body: {
      action: "plan",
      subscription: {
        plan: "LITE",
        source: "NUBRA_BASIC_BUNDLE",
        reason: "Contrato de pruebas",
      },
    },
  });
  assert.equal(
    (await call("/api/v1/subscription", { cookie: a.cookie })).data.subscription
      .code,
    "LITE",
  );
  checks++;
  const member = (
    await fixtureMember(db, a.organizationId, {
      cookie: admin,
      method: "POST",
      body: {
        name: "Empleado",
        email: "cashier@example.invalid",
        password,
        role: "CASHIER",
      },
      status: 201,
    })
  ).data.id;
  const cashier = await login("cashier@example.invalid");
  await call(`/api/v1/members/${member}`, {
    cookie: cashier,
    method: "PATCH",
    body: { role: "OWNER" },
    status: 403,
  });
  const p = (
    await call("/api/v1/products", {
      cookie: a.cookie,
      method: "POST",
      body: { name: "Producto", sku: "F-1", priceCents: 1250 },
      status: 201,
    })
  ).data.id;
  await call("/api/v1/inventory", {
    cookie: a.cookie,
    method: "POST",
    body: { productId: p, quantity: 10, reason: "Stock inicial" },
    status: 201,
  });
  const saleBody = {
    customerId: ca,
    idempotencyKey: randomUUID(),
    items: [{ productId: p, quantity: 3 }],
  };
  const sales = await Promise.all(
    [1, 2, 3].map(() =>
      call("/api/v1/sales", {
        cookie: a.cookie,
        method: "POST",
        body: saleBody,
        status: 201,
      }),
    ),
  );
  assert.equal(new Set(sales.map((r) => r.data.id)).size, 1);
  assert.equal(
    (await call(`/api/v1/products/${p}`, { cookie: a.cookie })).data.stock,
    7,
  );
  checks += 2;
  await call("/api/v1/sales", {
    cookie: a.cookie,
    method: "POST",
    body: { ...saleBody, items: [{ productId: p, quantity: 2 }] },
    status: 409,
  });
  await Promise.all(
    [1, 2].map(() =>
      call(`/api/v1/sales/${sales[0].data.id}/cancel`, {
        cookie: a.cookie,
        method: "POST",
        body: {},
      }),
    ),
  );
  assert.equal(
    (await call(`/api/v1/products/${p}`, { cookie: a.cookie })).data.stock,
    10,
  );
  checks++;
  await call("/api/v1/payments", {
    cookie: a.cookie,
    method: "POST",
    body: {
      saleId: sales[0].data.id,
      amountCents: 100,
      method: "TRANSFER",
      idempotencyKey: randomUUID(),
    },
    status: 404,
  });
  // Limits update immediately, including concurrent consumption.
  await call("/api/internal/admin/plans", {
    cookie: admin,
    method: "PATCH",
    body: {
      plan: "LITE",
      feature: "csv_exports",
      enabled: true,
      limit: 2,
      reason: "Prueba de límite",
    },
  });
  await call("/api/v1/exports/customers", {
    cookie: a.cookie,
    method: "POST",
    body: {},
  });
  await call("/api/v1/exports/customers", {
    cookie: a.cookie,
    method: "POST",
    body: {},
    status: 403,
  });
  await call(`/api/internal/admin/organizations/${a.organizationId}`, {
    cookie: admin,
    method: "POST",
    body: {
      action: "status",
      status: "SUSPENDED",
      reason: "Prueba de suspensión",
    },
  });
  await call("/api/v1/customers", { cookie: a.cookie, status: 401 });
  await call(`/api/internal/admin/organizations/${a.organizationId}`, {
    cookie: admin,
    method: "POST",
    body: {
      action: "status",
      status: "APPROVED",
      reason: "Prueba de reactivación",
    },
  });
  a.cookie = await login(a.email);
  assert.equal(
    Number(
      (
        await db.query(
          "SELECT COUNT(*) AS n FROM legal_acceptances WHERE user_id=$1 AND organization_id=$2",
          [userId, a.organizationId],
        )
      ).rows[0].n,
    ),
    2,
  );
  checks++;
  assert(
    (
      await db.query(
        "SELECT id FROM platform_audit_logs WHERE action='application.approved' AND organization_id=$1 AND staff_id IS NOT NULL",
        [a.organizationId],
      )
    ).rows.length === 1,
  );
  checks++;
  // Real browser: CSP hydration, authenticated pending state, internal review, mobile layout.
  browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge",
    headless: true,
  });
  const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/register");
  await expect(
    page.getByRole("heading", { name: "Empecemos por vos." }),
  ).toBeVisible();
  await page.getByLabel("Nombre y apellido").fill("Persona en navegador");
  const email = `browser-foundation-${randomUUID()}@example.invalid`;
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: false }).fill(password);
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(page.getByRole("status")).toBeVisible();
  const mail = globalThis.__nubraTestMail.find((m) =>
    m.recipient.includes(email),
  );
  const token = mail.raw.match(/#token=([a-f0-9]{64})/)[1];
  await page.goto(base + "/verify-email#token=" + token);
  await page.getByRole("button", { name: "Verificar email" }).click();
  await expect(page.getByRole("status")).toContainText("Email verificado");
  await page.goto(base + "/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Contanos sobre tu negocio" }),
  ).toBeVisible();
  await page.getByLabel("Nombre comercial").fill("Negocio navegador");
  await page.getByRole("checkbox").nth(2).check();
  await page.getByRole("checkbox").nth(3).check();
  await page.getByRole("button", { name: "Enviar solicitud a NUBRA" }).click();
  await expect(
    page.getByText("Pendiente de revisión", { exact: true }),
  ).toBeVisible();
  await page.goto(base + "/internal");
  await page
    .getByLabel("Usuario", { exact: true })
    .fill(process.env.ADMIN_USERNAME);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill(process.env.ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Negocio navegador" }),
  ).toBeVisible();
  await page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Negocio navegador" }) })
    .getByRole("button", { name: "Aprobar empresa" })
    .click();
  await expect(
    page
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name: "Negocio navegador" }) })
      .getByText("Aprobada", { exact: true }),
  ).toBeVisible();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
    false,
  );
  assert.deepEqual(errors, []);
  checks += 2;
  console.log(
    `PASS: ${checks} foundation assertions, local SMTP verification, public registration and approval E2E.`,
  );
} finally {
  await browser?.close();
  await db.end();
}
