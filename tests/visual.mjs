import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
const base = process.env.TEST_BASE_URL;
if (!new URL(process.env.DATABASE_URL).pathname.startsWith("/nubra_test_"))
  throw new Error("Isolated database required");
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge",
});
await mkdir(".local/qa", { recursive: true });
let checks = 0;
try {
  const context = await browser.newContext(),
    page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  async function fits(label) {
    await page.waitForTimeout(80);
    const dimensions = await page.evaluate(() => ({
      content: document.documentElement.scrollWidth,
      viewport: innerWidth,
    }));
    assert(
      dimensions.content <= dimensions.viewport + 1,
      `${label}: ${JSON.stringify(dimensions)}`,
    );
    checks++;
  }
  for (const width of [1440, 1280, 1024, 768, 390, 360]) {
    await page.setViewportSize({ width, height: 960 });
    for (const route of [
      "/",
      "/plans",
      "/login",
      "/register",
      "/register-business",
      "/privacy",
      "/terms",
      "/admin",
      "/internal",
    ]) {
      await page.goto(base + route);
      await page.locator("body").waitFor();
      await fits(`${route} ${width}`);
      if (
        [1440, 360].includes(width) &&
        ["/", "/plans", "/admin", "/login"].includes(route)
      )
        await page.screenshot({
          animations: "disabled",
          path: `.local/qa/${route === "/" ? "landing" : route.slice(1)}-${width}.png`,
          fullPage: true,
        });
    }
  }
  const admin = await context.request.post(base + "/api/admin/login", {
    data: {
      username: process.env.ADMIN_USERNAME,
      password: process.env.ADMIN_PASSWORD,
    },
  });
  assert.equal(admin.status(), 200);
  const password = randomBytes(20).toString("hex"),
    email = `visual-${randomUUID()}@example.invalid`;
  const created = await context.request.post(
    base + "/api/admin/organizations",
    {
      data: {
        name: "Negocio de prueba visual",
        ownerName: "Propietario de prueba",
        ownerEmail: email,
        ownerPassword: password,
      },
    },
  );
  assert.equal(created.status(), 201);
  assert.equal(
    (
      await context.request.post(base + "/api/auth/login", {
        data: { email, password },
      })
    ).status(),
    200,
  );
  for (const width of [1440, 1280, 1024, 768, 390, 360]) {
    await page.setViewportSize({ width, height: 960 });
    await page.goto(base + "/");
    await expect(
      page.getByRole("heading", { name: /Todo listo para avanzar/ }),
    ).toBeVisible();
    await fits(`dashboard ${width}`);
    if ([1440, 360].includes(width))
      await page.screenshot({
        animations: "disabled",
        path: `.local/qa/dashboard-${width}.png`,
        fullPage: true,
      });
    for (const sectionName of [
      "Clientes",
      "Productos",
      "Inventario",
      "Ventas",
      "Presupuestos",
      "Pagos y caja",
      "Equipo y roles",
    ]) {
      const menu = page.getByRole("button", { name: "Abrir menú" });
      if (await menu.isVisible()) await menu.click();
      await page
        .getByRole("navigation", { name: "Navegación principal" })
        .getByRole("button", { name: sectionName, exact: true })
        .click();
      await fits(`${sectionName} ${width}`);
      if (sectionName === "Productos") {
        await page
          .getByRole("button", { name: "Nuevo producto", exact: true })
          .click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await fits(`product dialog ${width}`);
        if (width === 360)
          await page.screenshot({
            animations: "disabled",
            path: ".local/qa/product-dialog-360.png",
          });
        await page.keyboard.press("Escape");
      }
    }
    for (const route of [
      "/settings/security",
      "/settings/subscription",
      "/internal",
    ]) {
      await page.goto(base + route);
      await fits(`${route} ${width}`);
      if (width === 1440)
        await page.screenshot({
          animations: "disabled",
          path: `.local/qa/${route.split("/").at(-1)}-${width}.png`,
          fullPage: true,
        });
    }
  }
  assert.deepEqual(errors, []);
  console.log(
    `PASS: ${checks} responsive checks at 1440, 1280, 1024, 768, 390 and 360px; screenshots in .local/qa.`,
  );
} finally {
  await browser.close();
}
