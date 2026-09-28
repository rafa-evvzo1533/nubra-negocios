import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import pg from "pg";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const base = process.env.TEST_BASE_URL ?? "http://localhost:3100";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const email = `browser-${randomUUID()}@example.invalid`;
const password = randomBytes(24).toString("hex");
let organizationId, userId, adminHash, browser;
async function post(path, body, cookie) {
  const response = await fetch(base + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  assert(response.ok, `${path}: ${response.status}`);
  return response;
}
try {
  const admin = await post("/api/admin/login", {
    username: process.env.ADMIN_USERNAME,
    password: process.env.ADMIN_PASSWORD,
  });
  const cookie = admin.headers.get("set-cookie").split(";")[0];
  adminHash = createHash("sha256").update(cookie.split("=")[1]).digest("hex");
  const org = await (
    await post(
      "/api/admin/organizations",
      {
        name: "Workspace de prueba visual",
        ownerName: "Usuario de prueba",
        ownerEmail: email,
        ownerPassword: password,
      },
      cookie,
    )
  ).json();
  organizationId = org.organization.id;
  userId = (await db.query("SELECT id FROM users WHERE email=$1", [email]))
    .rows[0].id;
  browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge",
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1040 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base + "/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Todo listo para avanzar/ }),
  ).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  await nav.getByRole("button", { name: "Clientes", exact: true }).click();
  await page
    .getByRole("button", { name: "Nuevo cliente", exact: true })
    .first()
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nombre", { exact: true }).fill("Contacto de prueba");
  await dialog
    .getByLabel("Email", { exact: true })
    .fill("contacto@example.invalid");
  await dialog.getByLabel("Próximo contacto").fill("2030-01-15");
  await dialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(
    page.getByText("Contacto de prueba", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ver Contacto de prueba", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Qué pasó")
    .fill("Seguimiento registrado desde el navegador.");
  await dialog.getByRole("button", { name: "Registrar actividad" }).click();
  await expect(
    dialog.getByText("Seguimiento registrado desde el navegador."),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await nav.getByRole("button", { name: "Productos", exact: true }).click();
  for (const [name, sku, price] of [
    ["Producto Uno", "BROWSER-1", "12.50"],
    ["Producto Dos", "BROWSER-2", "25"],
  ]) {
    await page
      .getByRole("button", { name: "Nuevo producto", exact: true })
      .first()
      .click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nombre", { exact: true }).fill(name);
    await dialog.getByLabel("SKU", { exact: true }).fill(sku);
    await dialog.getByLabel("Precio (ARS)", { exact: true }).fill(price);
    await dialog.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  }
  const products = await (
    await context.request.get(base + "/api/v1/products")
  ).json();
  for (const product of products) {
    const response = await context.request.post(base + "/api/v1/inventory", {
      data: {
        productId: product.id,
        quantity: 10,
        reason: "Prueba de navegador",
      },
    });
    assert.equal(response.status(), 201);
  }
  await nav.getByRole("button", { name: "Ventas", exact: true }).click();
  await page
    .getByRole("button", { name: "Nueva venta", exact: true })
    .first()
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /Producto Uno.*BROWSER-1/ }).click();
  await dialog.getByRole("button", { name: /Producto Dos.*BROWSER-2/ }).click();
  await dialog
    .getByLabel("Cantidad de Producto Uno", { exact: true })
    .fill("2");
  await expect(dialog.getByText(/50,00/)).toBeVisible();
  await mkdir("test-results", { recursive: true });
  await page.screenshot({
    path: "test-results/cart-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth));
  await page.screenshot({
    path: "test-results/cart-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 1440, height: 1040 });
  await dialog.getByRole("button", { name: "Confirmar venta" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("row").filter({ hasText: "Consumidor final" }),
  ).toHaveCount(1);
  await nav.getByRole("button", { name: "Presupuestos", exact: true }).click();
  await page
    .getByRole("button", { name: "Nuevo presupuesto", exact: true })
    .first()
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /Producto Uno.*BROWSER-1/ }).click();
  await dialog.getByLabel("Observaciones").fill("Condiciones de prueba.");
  await dialog.getByRole("button", { name: "Guardar presupuesto" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: /^Ver / }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Marcar como enviado" }).click();
  await dialog.getByRole("button", { name: "Marcar como aceptado" }).click();
  await dialog.getByRole("button", { name: "Convertir en venta" }).click();
  await expect(
    dialog.getByText("Venta creada. El stock fue actualizado."),
  ).toBeVisible();
  await expect(dialog.getByText("Convertido", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+k");
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Búsqueda global").fill("Producto Uno");
  await dialog.getByRole("button", { name: /Producto Uno.*BROWSER-1/ }).click();
  await expect(
    page.getByRole("heading", { name: "Productos", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Producto Uno" }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("row").filter({ hasText: "Producto Dos" }),
  ).toHaveCount(0);
  await nav.getByRole("button", { name: "Inicio", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ritmo de ventas" }),
  ).toBeVisible();
  await mkdir("test-results", { recursive: true });
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Abrir menú" })).toBeVisible();
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await nav.getByRole("button", { name: "Clientes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Clientes", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Nuevo cliente", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  assert(
    await page
      .getByRole("dialog")
      .evaluate(
        (element) => element.getBoundingClientRect().width <= window.innerWidth,
      ),
  );
  await page.keyboard.press("Escape");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await nav.getByRole("button", { name: "Inicio", exact: true }).click();
  assert.equal(
    await page
      .getByRole("heading", { name: /Todo listo para avanzar/ })
      .evaluate(
        (el) =>
          getComputedStyle(el.parentElement.parentElement.parentElement)
            .animationDuration,
      ),
    "0s",
  );
  assert.deepEqual(errors, []);
  const stock = (
    await db.query(
      "SELECT stock FROM products WHERE organization_id=$1 AND sku=$2",
      [organizationId, "BROWSER-1"],
    )
  ).rows[0].stock;
  assert.equal(stock, 7);
  console.log(
    "PASS: browser login, customer follow-up, product creation, multi-product sale, quote conversion, global search, mobile navigation, dialog keyboard behavior and reduced motion.",
  );
} finally {
  if (browser) await browser.close();
  if (organizationId) {
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
      await db.query(`DELETE FROM ${table} WHERE organization_id=$1`, [
        organizationId,
      ]);
    await db.query("DELETE FROM organizations WHERE id=$1", [organizationId]);
  }
  if (userId) await db.query("DELETE FROM users WHERE id=$1", [userId]);
  if (adminHash)
    await db.query("DELETE FROM sessions WHERE token_hash=$1", [adminHash]);
  await db.end();
}
