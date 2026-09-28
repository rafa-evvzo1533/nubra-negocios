import assert from "node:assert/strict";
import {
  randomUUID,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import pg from "pg";
import { fixtureMember } from "./fixtures.mjs";
const base = process.env.TEST_BASE_URL;
if (!new URL(process.env.DATABASE_URL).pathname.startsWith("/nubra_test_"))
  throw new Error("Isolated database required");
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let checks = 0;
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
  const raw = await r.text();
  assert.equal(r.status, status, `${method} ${path}: ${raw.slice(0, 400)}`);
  checks++;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = raw;
  }
  return { data, cookie: r.headers.get("set-cookie")?.split(";")[0] };
}
const login = async (email, password) =>
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
  const password = randomBytes(20).toString("hex"),
    orgs = [];
  for (const suffix of ["A", "B"]) {
    const email = `security-${randomUUID()}@example.invalid`;
    const r = await call("/api/admin/organizations", {
      cookie: admin,
      method: "POST",
      body: {
        name: `Security ${suffix}`,
        ownerName: "Security Owner",
        ownerEmail: email,
        ownerPassword: password,
      },
      status: 201,
    });
    const id = r.data.organization.id;
    const user = (
      await db.query("SELECT id,password_hash FROM users WHERE email=$1", [
        email,
      ])
    ).rows[0];
    assert(user.password_hash.startsWith("$argon2id$"));
    orgs.push({
      id,
      userId: user.id,
      email,
      cookie: await login(email, password),
    });
  }
  const [a, b] = orgs;
  const productBody = {
    name: "Monitor de prueba",
    sku: "SEC-MON",
    priceCents: 300000,
    minimumStock: 20,
  };
  const product = (
    await call("/api/v1/products", {
      method: "POST",
      cookie: a.cookie,
      body: productBody,
      status: 201,
    })
  ).data.id;
  assert.equal(
    (await call("/api/v1/products/" + product, { cookie: a.cookie })).data
      .stock,
    0,
  );
  await call("/api/v1/products/" + product, {
    method: "PUT",
    cookie: a.cookie,
    body: {
      ...productBody,
      stock: 20,
      expectedStock: 0,
      stockReason: "Conteo físico verificado",
    },
  });
  await call("/api/v1/products/" + product, {
    method: "PUT",
    cookie: a.cookie,
    body: {
      ...productBody,
      stock: 30,
      expectedStock: 0,
      stockReason: "Edición desactualizada",
    },
    status: 409,
  });
  await call("/api/v1/sales", {
    method: "POST",
    cookie: a.cookie,
    body: {
      items: [{ productId: product, quantity: 1 }],
      idempotencyKey: randomUUID(),
    },
    status: 201,
  });
  assert.equal(
    (await call("/api/v1/products/" + product, { cookie: a.cookie })).data
      .stock,
    19,
  );
  const adjustment = {
    idempotencyKey: randomUUID(),
    productId: product,
    quantity: 1,
    reason: "Reposición contada",
  };
  const first = (
    await call("/api/v1/inventory", {
      method: "POST",
      cookie: a.cookie,
      body: adjustment,
      status: 201,
    })
  ).data;
  assert.equal(
    (
      await call("/api/v1/inventory", {
        method: "POST",
        cookie: a.cookie,
        body: adjustment,
        status: 201,
      })
    ).data.id,
    first.id,
  );
  assert.equal(
    (await call("/api/v1/products/" + product, { cookie: a.cookie })).data
      .stock,
    20,
  );
  await call("/api/v1/inventory", {
    method: "POST",
    cookie: a.cookie,
    body: { ...adjustment, quantity: 2 },
    status: 409,
  });
  await call("/api/v1/products/" + product, { cookie: b.cookie, status: 404 });
  await call("/api/v1/products/" + product, { cookie: admin, status: 401 });
  // This deliberately omits organization_id from SQL: RLS must still isolate it.
  const connection = await db.connect();
  try {
    await connection.query("BEGIN");
    await connection.query("SET LOCAL ROLE nubra_runtime");
    assert.equal(
      (await connection.query("SELECT * FROM products")).rowCount,
      0,
    );
    await connection.query(
      "SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true)",
      [b.id, b.userId],
    );
    assert.equal(
      (await connection.query("SELECT * FROM products WHERE id=$1", [product]))
        .rowCount,
      0,
    );
    await connection.query("SELECT set_config('app.organization_id',$1,true)", [
      a.id,
    ]);
    assert.equal(
      (await connection.query("SELECT * FROM products")).rowCount,
      0,
    );
    await connection.query("SELECT set_config('app.user_id',$1,true)", [
      a.userId,
    ]);
    assert.equal(
      (await connection.query("SELECT * FROM products")).rowCount,
      1,
    );
    await connection.query("SAVEPOINT tamper");
    await assert.rejects(
      connection.query("UPDATE platform_audit_logs SET action=$1", ["TAMPER"]),
      (e) => e.code === "42501",
    );
    await connection.query("ROLLBACK TO SAVEPOINT tamper");
    await connection.query("SAVEPOINT cross_write");
    await assert.rejects(
      connection.query(
        "INSERT INTO products(id,organization_id,name,sku,price_cents) VALUES($1,$2,$3,$4,0)",
        [randomUUID(), b.id, "Wrong org", "WRONG"],
      ),
      (e) => e.code === "42501",
    );
    await connection.query("ROLLBACK TO SAVEPOINT cross_write");
    await connection.query("ROLLBACK");
    assert.equal(
      (
        await connection.query(
          "SELECT current_setting('app.organization_id',true)",
        )
      ).rows[0].current_setting,
      "",
    );
    checks += 7;
  } finally {
    connection.release();
  }
  const rls = (
    await db.query(
      "SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname=ANY($1)",
      [
        [
          "customers",
          "products",
          "sales",
          "payments",
          "receipt_imports",
          "cash_movements",
          "organization_encryption_keys",
        ],
      ],
    )
  ).rows;
  assert.equal(rls.length, 7);
  assert(rls.every((r) => r.relrowsecurity && r.relforcerowsecurity));
  const memberEmail = `sales-${randomUUID()}@example.invalid`;
  const member = (
    await fixtureMember(db, a.id, {
      body: { name: "Seller", email: memberEmail, password, role: "SALES" },
    })
  ).data.id;
  const seller = await login(memberEmail, password);
  await call("/api/v1/finance", { cookie: seller, status: 403 });
  await call("/api/v1/support-access", { cookie: seller, status: 403 });
  for (const [path, method, body] of [
    [
      `/api/admin/organizations/${a.id}/members`,
      "POST",
      {
        name: "Forbidden",
        email: "forbidden@example.invalid",
        password,
        role: "OWNER",
      },
    ],
    [
      `/api/admin/organizations/${a.id}/members/${member}`,
      "PATCH",
      { role: "OWNER" },
    ],
    [`/api/admin/organizations/${a.id}/members/${member}`, "DELETE", undefined],
  ])
    await call(path, { cookie: admin, method, body, status: 403 });
  await call("/api/v1/customers", {
    cookie: a.cookie,
    method: "POST",
    body: {
      name: "Confidential customer",
      email: "private@example.invalid",
      phone: "555-0100",
      notes: "PRIVATE-NOTE",
    },
    status: 201,
  });
  await call("/api/internal/support/" + randomUUID() + "/customers", {
    cookie: admin,
    status: 403,
  });
  const req = (
    await call("/api/internal/support", {
      cookie: admin,
      method: "POST",
      body: {
        organizationId: a.id,
        reason: "Revisar un problema en la lista de clientes",
        scope: ["customers.read"],
        durationMinutes: 15,
      },
      status: 201,
    })
  ).data.id;
  await call("/api/v1/support-access/" + req, {
    cookie: b.cookie,
    method: "POST",
    body: { action: "APPROVE" },
    status: 404,
  });
  await call("/api/v1/support-access/" + req, {
    cookie: a.cookie,
    method: "POST",
    body: { action: "APPROVE" },
  });
  let requests = (await call("/api/internal/support", { cookie: admin })).data;
  const grant = requests.find((r) => r.id === req).grant_id;
  const preview = (
    await call(`/api/internal/support/${grant}/customers`, { cookie: admin })
  ).data.items;
  assert.equal(preview.length, 1);
  assert(!("email" in preview[0]));
  assert(!("notes" in preview[0]));
  assert(!("phone" in preview[0]));
  await call(`/api/internal/support/${grant}/sales`, {
    cookie: admin,
    status: 403,
  });
  await call(`/api/internal/support/${grant}/cash`, {
    cookie: admin,
    status: 403,
  });
  await db.query(
    "UPDATE support_access_grants SET expires_at=NOW()-INTERVAL '1 second' WHERE id=$1",
    [grant],
  );
  await call(`/api/internal/support/${grant}/customers`, {
    cookie: admin,
    status: 403,
  });
  await db.query(
    "UPDATE support_access_grants SET expires_at=NOW()+INTERVAL '5 minutes' WHERE id=$1",
    [grant],
  );
  await call("/api/v1/support-access/" + req, {
    cookie: a.cookie,
    method: "POST",
    body: { action: "REVOKE" },
  });
  await call(`/api/internal/support/${grant}/customers`, {
    cookie: admin,
    status: 403,
  });
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    randomBytes(80),
  ]).toString("base64");
  const receipt = (
    await call("/api/v1/receipts", {
      cookie: a.cookie,
      method: "POST",
      body: {
        image: png,
        totalCents: 2000,
        description: "Comprobante privado de prueba",
        reference: randomUUID(),
        soldOn: "2026-01-01",
        confirmed: true,
      },
      status: 201,
    })
  ).data.id;
  const file = (
    await call(`/api/v1/files/${receipt}/link`, {
      cookie: a.cookie,
      method: "POST",
      body: {},
    })
  ).data.url;
  await call(file, { cookie: a.cookie });
  await call(file, { cookie: b.cookie, status: 403 });
  await call(file, { cookie: admin, status: 401 });
  await db.query(
    "UPDATE private_file_links SET expires_at=NOW()-INTERVAL '1 second' WHERE organization_id=$1",
    [a.id],
  );
  await call(file, { cookie: a.cookie, status: 403 });
  const other = await login(a.email, password);
  const sessions = (await call("/api/auth/sessions", { cookie: a.cookie }))
    .data;
  assert(sessions.some((s) => s.current));
  assert(sessions.every((s) => !("token_hash" in s)));
  await call("/api/auth/sessions", {
    cookie: a.cookie,
    method: "DELETE",
    body: { target: "others" },
  });
  await call("/api/v1/products", { cookie: other, status: 401 });
  await call("/api/v1/products", { cookie: a.cookie });
  await call("/api/auth/sessions", {
    cookie: a.cookie,
    method: "DELETE",
    body: { target: "all" },
  });
  await call("/api/v1/products", { cookie: a.cookie, status: 401 });
  // Pure cryptographic tests run the actual TypeScript module with a test-only wrapping service.
  async function module(file) {
    const source = ts.transpileModule(await readFile(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    return import(
      "data:text/javascript;base64," + Buffer.from(source).toString("base64")
    );
  }
  const { EncryptionService } = await module(
    "src/server/security/encryption.ts",
  );
  const keys = new Map(),
    kek = randomBytes(32);
  const provider = {
    name: "test-only",
    async wrap(key, context) {
      const iv = randomBytes(12),
        c = createCipheriv("aes-256-gcm", kek, iv);
      c.setAAD(Buffer.from(context));
      return {
        wrapped: Buffer.concat([
          iv,
          c.update(key),
          c.final(),
          c.getAuthTag(),
        ]).toString("base64"),
        reference: "test-key",
      };
    },
    async unwrap(value, reference, context) {
      assert.equal(reference, "test-key");
      const b = Buffer.from(value, "base64"),
        d = createDecipheriv("aes-256-gcm", kek, b.subarray(0, 12));
      d.setAAD(Buffer.from(context));
      d.setAuthTag(b.subarray(-16));
      return Buffer.concat([d.update(b.subarray(12, -16)), d.final()]);
    },
  };
  const repo = {
    async current(org) {
      return (
        [...keys.values()].filter((k) => k.organizationId === org).at(-1) ??
        null
      );
    },
    async get(org, v) {
      return keys.get(org + ":" + v) ?? null;
    },
    async insert(k) {
      keys.set(k.organizationId + ":" + k.version, k);
    },
  };
  const encryption = new EncryptionService(provider, repo);
  const envelope = await encryption.encrypt(
    a.id,
    "record",
    "notes",
    "PRIVATE CONTENT",
  );
  assert(!JSON.stringify(envelope).includes("PRIVATE CONTENT"));
  assert.equal(
    await encryption.decrypt(a.id, "record", "notes", envelope),
    "PRIVATE CONTENT",
  );
  await assert.rejects(encryption.decrypt(b.id, "record", "notes", envelope));
  await assert.rejects(
    encryption.decrypt(a.id, "wrong-record", "notes", envelope),
  );
  await assert.rejects(
    encryption.decrypt(a.id, "record", "wrong-field", envelope),
  );
  const damaged = {
    ...envelope,
    ciphertext: Buffer.from("tampered").toString("base64"),
  };
  await assert.rejects(encryption.decrypt(a.id, "record", "notes", damaged));
  await encryption.rotate(a.id);
  assert.equal(
    await encryption.decrypt(a.id, "record", "notes", envelope),
    "PRIVATE CONTENT",
  );
  assert.equal(
    (await encryption.encrypt(a.id, "record", "notes", "NEW")).keyVersion,
    2,
  );
  const { sanitizeLogPayload } = await module("src/server/logging.ts");
  assert.deepEqual(
    sanitizeLogPayload({
      password: "secret",
      nested: { email: "private@example.invalid", token: "secret" },
      message: "Contact private@example.invalid",
    }),
    {
      password: "[REDACTED]",
      nested: { email: "[REDACTED]", token: "[REDACTED]" },
      message: "Contact [EMAIL]",
    },
  );
  checks += 10;
  console.log(
    `PASS: ${checks} security checks: RLS, stock, tenant isolation, admin boundaries, scoped support, files, revoked sessions, encryption integrity and log redaction.`,
  );
} finally {
  await db.end();
}
