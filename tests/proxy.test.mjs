import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";
import { NextRequest } from "next/server.js";

const require = createRequire(import.meta.url);
const source = (
  await readFile(new URL("../src/proxy.ts", import.meta.url), "utf8")
).replace(
  '"next/server"',
  JSON.stringify(pathToFileURL(require.resolve("next/server.js")).href),
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
const { proxy } = await import(
  "data:text/javascript;base64," + Buffer.from(outputText).toString("base64")
);

test("public HTTPS origin works behind an HTTP reverse proxy without trusting forwarded headers", () => {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    APP_URL: process.env.APP_URL,
  };
  try {
    process.env.NODE_ENV = "production";
    process.env.APP_URL = "https://negocios.example.com";
    const request = (origin, extra = {}) =>
      new NextRequest("http://127.0.0.1:3200/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", origin, ...extra },
      });
    const allowed = proxy(request("https://negocios.example.com"));
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get("x-middleware-next"), "1");
    assert.equal(
      allowed.headers.get("strict-transport-security"),
      "max-age=31536000",
    );
    assert.equal(proxy(request("http://127.0.0.1:3200")).status, 403);
    assert.equal(
      proxy(
        request("https://attacker.example", {
          "x-forwarded-host": "attacker.example",
          "x-forwarded-proto": "https",
        }),
      ).status,
      403,
    );
    assert.equal(
      proxy(
        request("https://negocios.example.com", {
          "sec-fetch-site": "cross-site",
        }),
      ).status,
      403,
    );

    process.env.NODE_ENV = "development";
    assert.equal(proxy(request("http://localhost:3200")).status, 200);
    delete process.env.APP_URL;
    process.env.NODE_ENV = "production";
    assert.equal(proxy(request("http://localhost:3200")).status, 200);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
