import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import test from "node:test";

test(
  "registration explains a mail outage before collecting credentials and does not consume attempts",
  { timeout: 60000 },
  async () => {
    const probe = net.createServer();
    await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
    const port = probe.address().port;
    await new Promise((resolve) => probe.close(resolve));
    const base = `http://localhost:${port}`;
    const server = spawn(
      process.execPath,
      ["node_modules/next/dist/bin/next", "start", "--port", String(port)],
      {
        windowsHide: true,
        env: {
          ...process.env,
          APP_URL: base,
          MAIL_ENABLED: "false",
          SMTP_HOST: "",
          SMTP_USER: "",
          SMTP_PASSWORD: "",
          // No production or development database is reachable from this test.
          DATABASE_URL:
            "postgresql://unused:unused@127.0.0.1:1/nubra_unavailable_test",
          MIGRATION_DATABASE_URL: "",
          ADMIN_PASSWORD: "",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let output = "";
    server.stdout.on("data", (data) => {
      output = (output + data).slice(-4000);
    });
    server.stderr.on("data", (data) => {
      output = (output + data).slice(-4000);
    });
    const exited = new Promise((resolve) => server.once("exit", resolve));
    try {
      let html;
      for (let i = 0; i < 80; i++) {
        assert.equal(server.exitCode, null, output);
        try {
          const response = await fetch(base + "/register");
          if (response.ok) {
            html = await response.text();
            break;
          }
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      assert.ok(html, output);
      assert.ok(html.includes("El registro está temporalmente pausado"));
      assert.ok(!html.includes('name="password"'));
      for (let attempt = 0; attempt < 4; attempt++) {
        const response = await fetch(base + "/api/auth/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: "Prueba",
            email: "outage@example.invalid",
            password: "Outage-Test-Password-2026",
          }),
        });
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), {
          error:
            "El envío de correos no está disponible en este momento. Probá más tarde.",
        });
      }
    } finally {
      if (server.exitCode === null) server.kill();
      await exited;
    }
  },
);
