import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import pg from "pg";
import { chromium, expect } from "@playwright/test";
if (!new URL(process.env.DATABASE_URL).pathname.startsWith("/nubra_test_"))
  throw new Error("Use isolated suite");
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL }),
  base = process.env.TEST_BASE_URL;
let checks = 0,
  browser;
async function call(
  path,
  { cookie, body, method = body ? "POST" : "GET", status = 200 } = {},
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  assert.equal(
    r.status,
    status,
    `${method} ${path}: ${r.status} ${JSON.stringify(data).slice(0, 200)}`,
  );
  checks++;
  return { data, cookie: r.headers.get("set-cookie")?.split(";")[0] };
}
try {
  const admin = (
    await call("/api/admin/login", {
      body: {
        username: process.env.ADMIN_USERNAME,
        password: process.env.ADMIN_PASSWORD,
      },
    })
  ).cookie;
  const password = randomBytes(24).toString("hex"),
    owners = [];
  for (let i = 0; i < 2; i++) {
    const email = `commerce-${randomUUID()}@example.invalid`;
    const r = await call("/api/admin/organizations", {
      cookie: admin,
      status: 201,
      body: {
        name: "Comercio QA " + i,
        ownerName: "Responsable",
        ownerEmail: email,
        ownerPassword: password,
      },
    });
    owners.push({
      id: r.data.organization.id,
      cookie: (await call("/api/auth/login", { body: { email, password } }))
        .cookie,
    });
  }
  const [a, b] = owners,
    req = (path, options = {}) => call(path, { cookie: a.cookie, ...options });
  await call("/api/v1/commerce/suppliers", { status: 401 });
  const supplier = (
    await req("/api/v1/commerce/suppliers", {
      body: { name: "Proveedor QA", category: "Insumos" },
      status: 201,
    })
  ).data;
  assert.equal(
    (await call("/api/v1/commerce/suppliers", { cookie: b.cookie })).data
      .length,
    0,
  );
  checks++;
  await call("/api/v1/commerce/suppliers?id=" + supplier.id, {
    cookie: b.cookie,
    method: "PUT",
    body: { name: "Intruso" },
    status: 404,
  });
  const productBody = {
    name: "Producto QA",
    sku: "COM-1",
    priceCents: 1000,
    costCents: 400,
    category: "Prueba",
    unit: "caja",
    supplierId: supplier.id,
    minimumStock: 2,
    stock: 20,
  };
  const product = (
    await req("/api/v1/products", { body: productBody, status: 201 })
  ).data;
  await call("/api/v1/products", {
    cookie: b.cookie,
    body: { ...productBody, sku: "FOREIGN" },
    status: 404,
  });
  const customer = (
    await req("/api/v1/customers", {
      body: {
        name: "Cliente QA",
        email: "",
        phone: "",
        notes: "",
        status: "ACTIVE",
        nextContact: "",
      },
      status: 201,
    })
  ).data;
  const pos = {
    idempotencyKey: randomUUID(),
    customerId: customer.id,
    items: [{ productId: product.id, quantity: 2 }],
    paidCents: 500,
    method: "TRANSFER",
  };
  const sale = (await req("/api/v1/commerce/pos", { body: pos, status: 201 }))
    .data;
  assert.equal(sale.balanceCents, 1500);
  checks++;
  assert.equal(
    (await req("/api/v1/commerce/pos", { body: pos, status: 201 })).data.id,
    sale.id,
  );
  checks++;
  await req("/api/v1/commerce/pos", {
    body: { ...pos, paidCents: 600 },
    status: 409,
  });
  assert.equal((await req("/api/v1/products/" + product.id)).data.stock, 18);
  checks++;
  await call("/api/v1/commerce/pos", {
    cookie: b.cookie,
    body: { ...pos, idempotencyKey: randomUUID() },
    status: 404,
  });
  await req("/api/v1/commerce/pos", {
    body: {
      ...pos,
      idempotencyKey: randomUUID(),
      paidCents: 2000,
      method: "CASH",
    },
    status: 409,
  });
  assert.equal((await req("/api/v1/products/" + product.id)).data.stock, 18);
  checks++;
  await req("/api/v1/commerce/pos", {
    body: {
      ...pos,
      idempotencyKey: randomUUID(),
      items: [{ productId: product.id, quantity: 30 }],
    },
    status: 409,
  });
  await req("/api/v1/commerce/pos", {
    body: { ...pos, idempotencyKey: randomUUID(), customerId: null },
    status: 400,
  });
  const second = (
    await req("/api/v1/commerce/pos", {
      body: {
        ...pos,
        idempotencyKey: randomUUID(),
        items: [{ productId: product.id, quantity: 1 }],
        paidCents: 0,
      },
      status: 201,
    })
  ).data;
  const account = (
    await req("/api/v1/commerce/accounts?customerId=" + customer.id)
  ).data;
  assert.equal(Number(account.customers[0].balance_cents), 2500);
  checks++;
  assert.equal(
    (await call("/api/v1/commerce/accounts", { cookie: b.cookie })).data
      .customers.length,
    0,
  );
  checks++;
  await call("/api/v1/commerce/accounts?customerId=" + customer.id, {
    cookie: b.cookie,
    status: 404,
  });
  const collection = {
    customerId: customer.id,
    amountCents: 1800,
    method: "TRANSFER",
    idempotencyKey: randomUUID(),
  };
  assert.equal(
    (await req("/api/v1/commerce/accounts", { body: collection, status: 201 }))
      .data.balanceCents,
    700,
  );
  checks++;
  await req("/api/v1/commerce/accounts", { body: collection, status: 201 });
  const paid = (
    await req("/api/v1/commerce/accounts?customerId=" + customer.id)
  ).data;
  assert.equal(
    Number(paid.sales.find((s) => s.id === sale.id).balance_cents),
    0,
  );
  checks++;
  assert.equal(
    Number(paid.sales.find((s) => s.id === second.id).balance_cents),
    700,
  );
  checks++;
  await req("/api/v1/commerce/accounts", {
    body: { ...collection, idempotencyKey: randomUUID(), amountCents: 701 },
    status: 409,
  });
  await req("/api/v1/commerce/accounts", {
    body: { ...collection, amountCents: 600 },
    status: 409,
  });
  await req("/api/v1/products/" + product.id, {
    method: "PUT",
    body: { ...productBody, costCents: 900, stock: 17, expectedStock: 17 },
  });
  const now = new Date(),
    from = new Date(now.getTime() - 86400000).toISOString().slice(0, 10),
    to = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
  const report = (await req(`/api/v1/commerce/reports?from=${from}&to=${to}`))
    .data;
  assert.equal(report.totals.sales, 2);
  assert.equal(Number(report.products[0].gross_margin_cents), 1800);
  checks += 2;
  assert.equal(
    (
      await call(`/api/v1/commerce/reports?from=${from}&to=${to}`, {
        cookie: b.cookie,
      })
    ).data.totals.sales,
    0,
  );
  checks++;
  await req("/api/v1/commerce/reports?from=2020-01-01&to=2030-01-01", {
    status: 400,
  });
  assert(
    (await req("/api/v1/commerce/audit")).data.some(
      (e) => e.action === "sales.pos_created",
    ),
  );
  checks++;
  await db.query(
    "UPDATE usage_records SET amount=100 WHERE organization_id=$1 AND feature_id=(SELECT id FROM features WHERE key='monthly_sales')",
    [a.id],
  );
  await req("/api/v1/commerce/pos", {
    body: { ...pos, idempotencyKey: randomUUID() },
    status: 403,
  });
  await req("/api/v1/sales", {
    body: {
      idempotencyKey: randomUUID(),
      customerId: customer.id,
      items: pos.items,
    },
    status: 403,
  });
  assert.equal((await req("/api/v1/products/" + product.id)).data.stock, 17);
  checks++;
  const sub = (await req("/api/v1/subscription")).data;
  assert.equal(sub.subscription.expires_at, null);
  assert.equal(sub.usage.monthly_sales, 100);
  checks += 2;
  // Tenant RLS also protects the new tables when SQL omits the organization filter.
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE nubra_runtime");
    await client.query("SELECT set_config('app.organization_id',$1,true)", [
      b.id,
    ]);
    assert.equal(
      (await client.query("SELECT * FROM suppliers")).rows.length,
      0,
    );
    checks++;
    await client.query("ROLLBACK");
  } finally {
    client.release();
  }
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  await context.addCookies([
    { name: a.cookie.split("=")[0], value: a.cookie.split("=")[1], url: base },
  ]);
  const page = await context.newPage();
  await page.goto(base);
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  await nav.getByRole("button", { name: "Proveedores", exact: true }).click();
  await page
    .getByRole("button", { name: "Nuevo proveedor", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Nombre", { exact: true })
    .fill("Proveedor navegador");
  await page
    .getByRole("button", { name: "Guardar proveedor", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Cambios guardados correctamente." }),
  ).toBeVisible();
  checks++;
  await page
    .getByRole("row")
    .filter({ hasText: "Proveedor navegador" })
    .getByRole("button", { name: "Archivar" })
    .click();
  const confirm = page.getByRole("dialog", { name: "Confirmar acción" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(
    page.getByRole("row").filter({ hasText: "Proveedor navegador" }),
  ).toContainText("Archivado");
  checks++;
  for (const name of [
    "Cuenta corriente",
    "Reportes",
    "Venta rápida",
    "Historial de actividad",
  ]) {
    await nav.getByRole("button", { name, exact: true }).click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    checks++;
  }
  console.log(
    `PASS: ${checks} commerce checks (POS, rollback, retry, accounts, costs, quotas, isolation, notifications and browser).`,
  );
} finally {
  await browser?.close();
  await db.end();
}
