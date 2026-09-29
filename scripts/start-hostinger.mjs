import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const require = createRequire(import.meta.url);
// hPanel owns process lifecycle, routing and the port. Never migrate or kill processes here.
if (process.env.MIGRATION_DATABASE_URL || process.env.ADMIN_PASSWORD)
  throw new Error(
    "Remove migration and bootstrap credentials from the hosted runtime. Provision them separately.",
  );
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Invalid PORT");
const child = spawn(
  process.execPath,
  [
    require.resolve("next/dist/bin/next"),
    "start",
    "--hostname",
    "0.0.0.0",
    "--port",
    String(port),
  ],
  {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production" },
    windowsHide: true,
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", () => {
  console.error("Unable to start Next.js. Check the deployment build.");
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
