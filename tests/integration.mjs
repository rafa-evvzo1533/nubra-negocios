import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import pg from "pg";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const base = process.env.TEST_BASE_URL ?? "http://localhost:3100";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const orgs = [];
const users = [];
const sessionHashes = [];
let checks = 0;
async function call(
  path,
  { method = "GET", cookie, body, status = 200, headers = {} } = {},
) {
  if (path === "/api/v1/sales" && method === "POST" && body)
    body = { idempotencyKey: randomUUID(), ...body };
  const response = await fetch(base + path, {
    method,
    redirect: "manual",
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal(
    response.status,
    status,
    `${method} ${path}: expected ${status}, got ${response.status}`,
  );
  checks++;
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { data, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
async function login(email, password) {
  return (
    await call("/api/auth/login", { method: "POST", body: { email, password } })
  ).cookie;
}
try {
  await call("/");
  await call("/", { cookie: "nubra_user_session=invalid" });
  await call("/admin");
  await call("/login");
  await call("/api/admin/organizations", { status: 401 });
  await call("/api/admin/login", {
    method: "POST",
    body: { username: "invalid", password: "invalid" },
    status: 401,
  });
  const admin = await call("/api/admin/login", {
    method: "POST",
    body: {
      username: process.env.ADMIN_USERNAME,
      password: process.env.ADMIN_PASSWORD,
    },
  });
  const adminToken = admin.cookie.split("=")[1];
  const { createHash } = await import("node:crypto");
  sessionHashes.push(createHash("sha256").update(adminToken).digest("hex"));
  const password = randomBytes(24).toString("hex");
  const owners = [];
  for (const label of ["A", "B"]) {
    const email = `integration-${randomUUID()}@example.invalid`;
    const result = await call("/api/admin/organizations", {
      method: "POST",
      cookie: admin.cookie,
      status: 201,
      body: {
        name: `Integration ${label}`,
        ownerName: `Owner ${label}`,
        ownerEmail: email,
        ownerPassword: password,
      },
    });
    orgs.push(result.data.organization.id);
    const user = (
      await db.query("SELECT id FROM users WHERE email=$1", [email])
    ).rows[0].id;
    users.push(user);
    owners.push(await login(email, password));
  }
  const [a, b] = owners;
  await call("/api/auth/login", {
    method: "POST",
    body: { email: `integration-unknown@example.invalid`, password },
    status: 401,
  });
  await call("/", { cookie: a });
  await call("/api/admin/organizations", { cookie: admin.cookie });
  await call("/api/auth/login", {
    method: "POST",
    body: {
      email: (await db.query("SELECT email FROM users WHERE id=$1", [users[0]]))
        .rows[0].email,
      password: "incorrect-password",
    },
    status: 401,
  });
  await call("/api/v1/customers", { status: 401 });
  await call("/api/v1/customers", { cookie: admin.cookie, status: 401 });
  await call("/api/v1/customers", {
    method: "POST",
    cookie: a,
    headers: { origin: "https://attacker.invalid" },
    body: { name: "Denied" },
    status: 403,
  });
  const ca = (
    await call("/api/v1/customers", {
      method: "POST",
      cookie: a,
      body: { name: "Customer A" },
      status: 201,
    })
  ).data.id;
  const cb = (
    await call("/api/v1/customers", {
      method: "POST",
      cookie: b,
      body: { name: "Customer B" },
      status: 201,
    })
  ).data.id;
  const pa = (
    await call("/api/v1/products", {
      method: "POST",
      cookie: a,
      body: { name: "Product A", sku: "SAME-SKU", priceCents: 1250 },
      status: 201,
    })
  ).data.id;
  const pb = (
    await call("/api/v1/products", {
      method: "POST",
      cookie: b,
      body: { name: "Product B", sku: "SAME-SKU", priceCents: 3000 },
      status: 201,
    })
  ).data.id;
  for (const [resource, id] of [
    ["customers", cb],
    ["products", pb],
  ]) {
    await call(`/api/v1/${resource}/${id}`, { cookie: a, status: 404 });
    await call(`/api/v1/${resource}/${id}`, {
      method: "PUT",
      cookie: a,
      body: { name: "Stolen" },
      status: 404,
    });
    await call(`/api/v1/${resource}/${id}`, {
      method: "DELETE",
      cookie: a,
      status: 404,
    });
    const rows = (
      await call(`/api/v1/${resource}?organizationId=${orgs[1]}`, { cookie: a })
    ).data;
    assert(!rows.some((r) => r.id === id));
    checks++;
  }
  await call("/api/v1/customers", {
    method: "POST",
    cookie: a,
    body: { name: "Spoof", organizationId: orgs[1] },
    status: 400,
  });
  await call("/api/v1/products", {
    method: "POST",
    cookie: a,
    body: { name: "Bad", sku: "BAD", priceCents: -1 },
    status: 400,
  });
  await call("/api/v1/inventory", {
    method: "POST",
    cookie: a,
    body: { productId: pb, quantity: 10, reason: "Foreign" },
    status: 409,
  });
  await call("/api/v1/inventory", {
    method: "POST",
    cookie: a,
    body: { productId: pa, quantity: 10, reason: "Initial stock" },
    status: 201,
  });
  await call("/api/v1/inventory", {
    method: "POST",
    cookie: b,
    body: { productId: pb, quantity: 5, reason: "Initial stock" },
    status: 201,
  });
  await call("/api/v1/sales", {
    method: "POST",
    cookie: a,
    body: { customerId: cb, items: [{ productId: pa, quantity: 1 }] },
    status: 404,
  });
  await call("/api/v1/sales", {
    method: "POST",
    cookie: a,
    body: { items: [{ productId: pb, quantity: 1 }] },
    status: 409,
  });
  await call("/api/v1/sales", {
    method: "POST",
    cookie: a,
    body: { items: [{ productId: pa, quantity: 11 }] },
    status: 409,
  });
  const sa = (
    await call("/api/v1/sales", {
      method: "POST",
      cookie: a,
      body: { customerId: ca, items: [{ productId: pa, quantity: 2 }] },
      status: 201,
    })
  ).data.id;
  const sb = (
    await call("/api/v1/sales", {
      method: "POST",
      cookie: b,
      body: { items: [{ productId: pb, quantity: 1 }] },
      status: 201,
    })
  ).data.id;
  await call(`/api/v1/sales/${sb}`, { cookie: a, status: 404 });
  const sale = (await call(`/api/v1/sales/${sa}`, { cookie: a })).data;
  assert.equal(Number(sale.total_cents), 2500);
  checks++;
  assert.equal(
    (await call(`/api/v1/products/${pa}`, { cookie: a })).data.stock,
    8,
  );
  checks++;
  const summary = (await call("/api/v1/dashboard/summary", { cookie: a })).data;
  assert.equal(summary.today, "2500");
  assert.equal(summary.month, "2500");
  assert.equal(summary.customers, 1);
  checks += 3;
  assert.equal((await call("/api/v1/sales", { cookie: a })).data.length, 1);
  checks++;
  assert(
    (await call("/api/v1/inventory", { cookie: a })).data.every(
      (r) => r.organization_id === orgs[0],
    ),
  );
  checks++;
  for (const resource of ["customers", "products"]) {
    const body =
      resource === "customers"
        ? { name: "Temporary customer" }
        : { name: "Temporary product", sku: "TEMP", priceCents: 1 };
    const id = (
      await call("/api/v1/" + resource, {
        method: "POST",
        cookie: a,
        body,
        status: 201,
      })
    ).data.id;
    await call("/api/v1/" + resource + "/" + id, {
      method: "PUT",
      cookie: a,
      body: { ...body, name: "Updated" },
    });
    assert.equal(
      (await call("/api/v1/" + resource + "/" + id, { cookie: a })).data.name,
      "Updated",
    );
    checks++;
    await call("/api/v1/" + resource + "/" + id, {
      method: "DELETE",
      cookie: a,
    });
    await call("/api/v1/" + resource + "/" + id, { cookie: a, status: 404 });
  }
  const foreignMovement = (await call("/api/v1/inventory", { cookie: b }))
    .data[0].id;
  await call(`/api/v1/inventory/${foreignMovement}`, {
    cookie: a,
    status: 404,
  });
  // A failed later line must roll back any earlier stock changes.
  const laterId = "ffffffff-ffff-4fff-bfff-ffffffffffff";
  await call("/api/v1/sales", {
    method: "POST",
    cookie: a,
    body: {
      items: [
        { productId: pa, quantity: 1 },
        { productId: laterId, quantity: 1 },
      ],
    },
    status: 409,
  });
  assert.equal(
    (await call("/api/v1/products/" + pa, { cookie: a })).data.stock,
    8,
  );
  checks++;
  const page = (await call("/", { cookie: a })).data;
  assert(!page.includes("Customer B"));
  checks++;
  // Both concurrent sales compete for the same stock: exactly one succeeds.
  const concurrent = await Promise.all(
    [1, 2].map(() =>
      fetch(base + "/api/v1/sales", {
        method: "POST",
        headers: { cookie: a, "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: randomUUID(),
          items: [{ productId: pa, quantity: 6 }],
        }),
      }),
    ),
  );
  assert.deepEqual(concurrent.map((r) => r.status).sort(), [201, 409]);
  checks++;
  assert.equal(
    (await call(`/api/v1/products/${pa}`, { cookie: a })).data.stock,
    2,
  );
  checks++;
  // Database constraints also reject cross-tenant relationships.
  await assert.rejects(
    db.query(
      "INSERT INTO sales(id,organization_id,customer_id,total_cents) VALUES($1,$2,$3,0)",
      [randomUUID(), orgs[0], cb],
    ),
    (e) => e.code === "23503",
  );
  checks++;
  // Search, pagination and filters remain tenant scoped.
  const paged = (
    await call("/api/v1/products?paginated=1&pageSize=1&q=Product", {
      cookie: a,
    })
  ).data;
  assert.equal(paged.total, 1);
  assert.equal(paged.items[0].id, pa);
  checks += 2;
  assert.equal(
    (await call("/api/v1/products?paginated=1&q=Product%20B", { cookie: a }))
      .data.total,
    0,
  );
  checks++;
  await call("/api/v1/products?paginated=1&page=-1", {
    cookie: a,
    status: 400,
  });
  await call("/api/v1/products?filter=LEAD", { cookie: a, status: 400 });
  await call("/api/v1/customers/" + ca, {
    method: "PUT",
    cookie: a,
    body: { name: "Customer A", status: "LEAD", nextContact: "2000-01-01" },
  });
  assert.equal(
    (await call("/api/v1/customers?filter=due", { cookie: a })).data[0].id,
    ca,
  );
  checks++;
  await call("/api/v1/customers/" + ca + "/activities", {
    method: "POST",
    cookie: a,
    body: { kind: "CALL", description: "Follow up for A" },
  });
  assert.equal(
    (await call("/api/v1/customers/" + ca + "/activities", { cookie: a })).data
      .length,
    1,
  );
  checks++;
  await call("/api/v1/customers/" + cb + "/activities", {
    cookie: a,
    status: 404,
  });
  await call("/api/v1/customers/" + cb + "/activities", {
    method: "POST",
    cookie: a,
    body: { kind: "NOTE", description: "Cross-tenant" },
    status: 404,
  });
  await call("/api/v1/quotes", {
    method: "POST",
    cookie: a,
    body: { customerId: cb, items: [{ productId: pa, quantity: 1 }] },
    status: 404,
  });
  await call("/api/v1/quotes", {
    method: "POST",
    cookie: a,
    body: { items: [{ productId: pb, quantity: 1 }] },
    status: 404,
  });
  const qa = (
    await call("/api/v1/quotes", {
      method: "POST",
      cookie: a,
      body: {
        customerId: ca,
        items: [{ productId: pa, quantity: 1 }],
        notes: "Quote A",
      },
      status: 201,
    })
  ).data.id;
  const qb = (
    await call("/api/v1/quotes", {
      method: "POST",
      cookie: b,
      body: { items: [{ productId: pb, quantity: 1 }] },
      status: 201,
    })
  ).data.id;
  await call("/api/v1/quotes/" + qb, { cookie: a, status: 404 });
  await call("/api/v1/quotes/" + qb + "/status", {
    method: "POST",
    cookie: a,
    body: { status: "SENT" },
    status: 404,
  });
  await call("/api/v1/quotes/" + qb + "/convert", {
    method: "POST",
    cookie: a,
    body: {},
    status: 404,
  });
  assert.equal(
    (await call("/api/v1/products/" + pa, { cookie: a })).data.stock,
    2,
  );
  checks++;
  assert.equal(
    (await call("/api/v1/quotes/" + qa, { cookie: a })).data.items[0]
      .price_cents,
    1250,
  );
  checks++;
  await call("/api/v1/quotes/" + qa + "/convert", {
    method: "POST",
    cookie: a,
    body: {},
    status: 409,
  });
  await call("/api/v1/quotes/" + qa + "/status", {
    method: "POST",
    cookie: a,
    body: { status: "ACCEPTED" },
    status: 409,
  });
  await call("/api/v1/quotes/" + qa + "/status", {
    method: "POST",
    cookie: a,
    body: { status: "SENT" },
  });
  await call("/api/v1/quotes/" + qa + "/status", {
    method: "POST",
    cookie: a,
    body: { status: "ACCEPTED" },
  });
  // Changing the catalog must not alter the accepted quote price.
  await call("/api/v1/products/" + pa, {
    method: "PUT",
    cookie: a,
    body: { name: "Product A", sku: "SAME-SKU", priceCents: 2000 },
  });
  const conversions = await Promise.all(
    [1, 2].map(() =>
      call("/api/v1/quotes/" + qa + "/convert", {
        method: "POST",
        cookie: a,
        body: {},
      }),
    ),
  );
  assert.equal(conversions[0].data.id, conversions[1].data.id);
  checks++;
  assert.equal(
    (await call("/api/v1/sales/" + conversions[0].data.id, { cookie: a })).data
      .total_cents,
    "1250",
  );
  checks++;
  assert.equal(
    (await call("/api/v1/products/" + pa, { cookie: a })).data.stock,
    1,
  );
  checks++;
  await call("/api/v1/quotes/" + qa + "/status", {
    method: "POST",
    cookie: a,
    body: { status: "REJECTED" },
    status: 409,
  });
  const expired = (
    await call("/api/v1/quotes", {
      method: "POST",
      cookie: a,
      body: {
        validUntil: "2000-01-01",
        items: [{ productId: pa, quantity: 1 }],
      },
      status: 201,
    })
  ).data.id;
  await call("/api/v1/quotes/" + expired + "/status", {
    method: "POST",
    cookie: a,
    body: { status: "SENT" },
    status: 409,
  });
  // Conversion failure preserves accepted state and stock.
  const unavailable = (
    await call("/api/v1/quotes", {
      method: "POST",
      cookie: a,
      body: { items: [{ productId: pa, quantity: 2 }] },
      status: 201,
    })
  ).data.id;
  await call("/api/v1/quotes/" + unavailable + "/status", {
    method: "POST",
    cookie: a,
    body: { status: "SENT" },
  });
  await call("/api/v1/quotes/" + unavailable + "/status", {
    method: "POST",
    cookie: a,
    body: { status: "ACCEPTED" },
  });
  await call("/api/v1/quotes/" + unavailable + "/convert", {
    method: "POST",
    cookie: a,
    body: {},
    status: 409,
  });
  assert.equal(
    (await call("/api/v1/quotes/" + unavailable, { cookie: a })).data.status,
    "ACCEPTED",
  );
  checks++;
  const trend = (await call("/api/v1/dashboard/summary", { cookie: a })).data
    .trend;
  assert.equal(trend.length, 14);
  assert.equal(
    trend.reduce((sum, day) => sum + Number(day.total), 0),
    11250,
  );
  checks += 2;
  await call("/api/auth/workspaces", {
    method: "POST",
    cookie: a,
    body: { workspaceId: orgs[1] },
    status: 403,
  });
  await db.query(
    "INSERT INTO organization_members(id,organization_id,user_id,role) VALUES($1,$2,$3,'SUPPORT')",
    [randomUUID(), orgs[1], users[0]],
  );
  assert.equal(
    (await call("/api/auth/workspaces", { cookie: a })).data.length,
    2,
  );
  checks++;
  await call("/api/auth/workspaces", {
    method: "POST",
    cookie: a,
    body: { workspaceId: orgs[1] },
  });
  await call(`/api/v1/customers/${cb}`, { cookie: a });
  await call(`/api/v1/customers/${ca}`, { cookie: a, status: 404 });
  await call("/api/v1/customers", {
    method: "POST",
    cookie: a,
    body: { name: "Forbidden" },
    status: 403,
  });
  await call("/api/v1/quotes", { cookie: a, status: 403 });
  await call("/api/v1/customers/" + cb + "/activities", {
    method: "POST",
    cookie: a,
    body: { kind: "NOTE", description: "Forbidden" },
    status: 403,
  });
  await call("/api/v1/products", { cookie: a, status: 403 });
  await call("/api/v1/sales", { cookie: a, status: 403 });
  await db.query(
    "DELETE FROM organization_members WHERE organization_id=$1 AND user_id=$2",
    [orgs[1], users[0]],
  );
  await call("/api/v1/customers", { cookie: a, status: 401 });
  const renewed = await login(
    (await db.query("SELECT email FROM users WHERE id=$1", [users[0]])).rows[0]
      .email,
    password,
  );
  await call("/api/auth/logout", { method: "POST", cookie: renewed });
  await call("/api/v1/customers", { cookie: renewed, status: 401 });
  await db.query(
    "UPDATE sessions SET expires_at=NOW()-INTERVAL '1 second' WHERE user_id=$1",
    [users[1]],
  );
  await call("/api/v1/customers", { cookie: b, status: 401 });
  console.log(
    `PASS: ${checks} assertions covering authentication, CRUD isolation, RBAC, workspace membership, CSRF, atomic sales and session revocation.`,
  );
} finally {
  // Only records identified by this run are removed. No demo data remains.
  for (const table of [
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
    sessionHashes,
  ]);
  await db.end();
}
