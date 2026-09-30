// Creates and drops only its own randomly named LOCAL database. Never uses business data.
import { randomUUID, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import net from "node:net";
import http from "node:http";
import { pathToFileURL } from "node:url";
import path from "node:path";
import pg from "pg";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const original = new URL(
  process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL,
);
if (!["localhost", "127.0.0.1", "[::1]"].includes(original.hostname))
  throw new Error("Tests require a local PostgreSQL server");
const database = "nubra_test_" + randomUUID().replaceAll("-", "");
const control = new pg.Pool({ connectionString: original.toString() });
const testUrl = new URL(original);
testUrl.pathname = "/" + database;
let server;
const messages = [];
globalThis.__nubraTestMail = messages;
const payments = new Map(),
  preferences = [];
globalThis.__nubraTestPayments = payments;
globalThis.__nubraTestPreferences = preferences;
const mp = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (req.method === "POST" && req.url === "/checkout/preferences") {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const data = JSON.parse(raw);
    preferences.push(data);
    res.end(
      JSON.stringify({
        id: "fixture-" + preferences.length,
        init_point:
          "https://www.mercadopago.com.ar/checkout/test-" + preferences.length,
        sandbox_init_point:
          "https://sandbox.mercadopago.com.ar/checkout/test-" +
          preferences.length,
      }),
    );
  } else if (
    req.url.startsWith("/v1/payments/") &&
    payments.has(req.url.split("/").at(-1))
  )
    res.end(JSON.stringify(payments.get(req.url.split("/").at(-1))));
  else {
    res.statusCode = 404;
    res.end("{}");
  }
});
await new Promise((r) => mp.listen(0, "127.0.0.1", r));
const smtp = net.createServer((socket) => {
  socket.write("220 localhost test SMTP\r\n");
  let buffer = "",
    dataMode = false,
    lines = [],
    recipient = "";
  socket.on("data", (chunk) => {
    buffer += chunk.toString();
    let end;
    while ((end = buffer.indexOf("\r\n")) >= 0) {
      const line = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      if (dataMode) {
        if (line === ".") {
          messages.push({
            recipient,
            raw: lines.join("\r\n").replace(/=\r\n/g, "").replace(/=3D/g, "="),
          });
          lines = [];
          dataMode = false;
          socket.write("250 accepted\r\n");
        } else lines.push(line);
        continue;
      }
      if (/^EHLO|^HELO/.test(line)) socket.write("250 localhost\r\n");
      else if (/^RCPT TO:/i.test(line)) {
        recipient = line;
        socket.write("250 ok\r\n");
      } else if (line === "DATA") {
        dataMode = true;
        socket.write("354 continue\r\n");
      } else if (line === "QUIT") {
        socket.end("221 bye\r\n");
      } else socket.write("250 ok\r\n");
    }
  });
});
await new Promise((resolve) => smtp.listen(0, "127.0.0.1", resolve));
Object.assign(process.env, {
  DATABASE_URL: testUrl.toString(),
  MIGRATION_DATABASE_URL: testUrl.toString(),
  FILE_SIGNING_SECRET: randomBytes(32).toString("hex"),
  ADMIN_USERNAME: "test-admin",
  ADMIN_PASSWORD: randomBytes(24).toString("hex"),
  MAIL_ENABLED: "true",
  MAIL_ALLOW_LOCAL_SMTP: "true",
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: String(smtp.address().port),
  SMTP_USER: "",
  SMTP_PASSWORD: "",
  MAIL_FROM: "test@example.invalid",
  APP_URL: "http://localhost:3100",
  TEST_BASE_URL: "http://localhost:3100",
  BILLING_ENABLED: "true",
  MP_MODE: "sandbox",
  MP_ACCESS_TOKEN: "TEST-LOCAL-FIXTURE",
  MP_COLLECTOR_ID: "123456",
  MP_WEBHOOK_SECRET: randomBytes(32).toString("hex"),
  TEST_MP_URL: `http://127.0.0.1:${mp.address().port}`,
});
async function run(file, args = []) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file, ...args], {
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${file} failed (${code})`)),
    );
  });
}
try {
  await control.query(`CREATE DATABASE "${database}"`);
  await run("scripts/migrate.mjs");
  await run("scripts/migrate.mjs");
  await run("scripts/bootstrap-admin.mjs");
  server = spawn(
    process.execPath,
    [
      "--import",
      pathToFileURL(path.resolve("tests/mp-fetch.mjs")).href,
      "node_modules/next/dist/bin/next",
      "start",
      "--port",
      "3100",
    ],
    { env: process.env, stdio: "inherit", windowsHide: true },
  );
  let ready = false;
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null) throw new Error("Test server exited");
    try {
      if ((await fetch(process.env.TEST_BASE_URL + "/api/health")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!ready) throw new Error("Test server did not start");
  await run("--test", [
    "tests/csv.test.mjs",
    "tests/billing-period.test.mjs",
    "tests/proxy.test.mjs",
    "tests/mail-unavailable.test.mjs",
  ]);
  if (process.argv[2] !== "security") {
    await import("./foundation.mjs");
    await import("./roles-billing.mjs");
    await import("./commerce.mjs");
  }
  await import("./security.mjs");
  if (!process.argv[2])
    for (const test of ["integration", "browser", "operations", "visual"])
      await run(`tests/${test}.mjs`);
  console.log("PASS: isolated suite; migration replay succeeded.");
} finally {
  if (server && server.exitCode === null) {
    const exited = new Promise((r) => server.once("exit", r));
    server.kill();
    await exited;
  }
  await new Promise((r) => smtp.close(r));
  await new Promise((r) => mp.close(r));
  // Name is generated here and cannot identify the configured development database.
  if (!/^nubra_test_[a-f0-9]{32}$/.test(database))
    throw new Error("Unsafe test database name");
  await control.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
  await control.end();
}
