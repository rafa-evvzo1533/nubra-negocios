// One command prepares the schema, builds every route, then starts a fresh server.
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import net from "node:net";
import path from "node:path";
import {
  mkdir,
  writeFile,
  readFile,
  unlink,
  open,
  stat,
} from "node:fs/promises";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
// Never carry an insecure TLS override into SMTP, payments or a key service.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";
const exec = promisify(execFile),
  root = process.cwd(),
  stateFile = path.join(root, ".local", "runtime.json");
let server,
  preparing,
  startupLock,
  cancelled = false;
const startupLockPath = path.join(root, ".local", "startup.lock");
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    cancelled = true;
    preparing?.kill();
    server?.kill();
  });
async function acquireStartupLock() {
  const started = Date.now();
  let announced = false;
  while (!cancelled && Date.now() - started < 600000) {
    try {
      const file = await open(startupLockPath, "wx");
      await file.writeFile(JSON.stringify({ pid: process.pid }));
      return file;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }
    try {
      const previous = JSON.parse(await readFile(startupLockPath, "utf8"));
      try {
        process.kill(previous.pid, 0);
      } catch (e) {
        if (e.code === "ESRCH") {
          await unlink(startupLockPath).catch(() => {});
          continue;
        }
      }
    } catch {
      const info = await stat(startupLockPath).catch(() => null);
      if (info && Date.now() - info.mtimeMs > 10000)
        await unlink(startupLockPath).catch(() => {});
    }
    if (!announced) {
      console.log(
        "Otro inicio de Nubra está en curso. Esperando a que termine...",
      );
      announced = true;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("El inicio anterior sigue en curso. Revisá su terminal.");
}
async function releaseStartupLock() {
  if (!startupLock) return;
  await startupLock.close();
  startupLock = undefined;
  await unlink(startupLockPath).catch(() => {});
}
const flags = process.argv.slice(2),
  portIndex = flags.indexOf("--port");
let port = Number(
  (portIndex >= 0 ? flags[portIndex + 1] : undefined) ||
    process.env.PORT ||
    3000,
);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Invalid port");
async function stopOwned(pid) {
  if (!pid || pid === process.pid) return false;
  if (process.platform === "win32") {
    const quoted = root.replaceAll("'", "''");
    const script = `$p=Get-CimInstance Win32_Process -Filter "ProcessId=${Number(pid)}"; if($p -and $p.Name -eq 'node.exe' -and $p.CommandLine.Contains('${quoted}')) { Stop-Process -Id $p.ProcessId -Force; Write-Output 'stopped' }`;
    const result = await exec(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { windowsHide: true },
    );
    return result.stdout.includes("stopped");
  }
  return false;
}
async function available(n) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(false));
    s.listen(n, "127.0.0.1", () => s.close(() => resolve(true)));
  });
}
const appEnv = {
  ...process.env,
  MIGRATION_DATABASE_URL: "",
  ADMIN_PASSWORD: "",
  ADMIN_USERNAME: "",
};
async function run(file, args = [], env = process.env) {
  await new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [file, ...args], {
      cwd: root,
      env,
      stdio: "inherit",
      windowsHide: true,
    });
    preparing = p;
    p.on("error", reject);
    p.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error("Startup step failed: " + file)),
    );
  });
}
try {
  await mkdir(path.dirname(stateFile), { recursive: true });
  startupLock = await acquireStartupLock();
  try {
    const prior = JSON.parse(await readFile(stateFile, "utf8"));
    if (prior.root === root) await stopOwned(prior.serverPid);
  } catch {}
  if (process.platform === "win32" && !(await available(port))) {
    const result = await exec(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique`,
      ],
      { windowsHide: true },
    );
    for (const id of result.stdout.trim().split(/\s+/))
      if (/^\d+$/.test(id)) await stopOwned(Number(id));
  }
  const requested = port;
  while (!(await available(port))) {
    port++;
    if (port > requested + 20) throw new Error("No free local port found");
  }
  if (port !== requested)
    console.log(
      `Port ${requested} belongs to another application; using ${port}.`,
    );
  const publicUrl = new URL(appEnv.APP_URL || "http://localhost:3000");
  if (["localhost", "127.0.0.1"].includes(publicUrl.hostname)) {
    publicUrl.port = String(port);
    appEnv.APP_URL = publicUrl.origin;
  }
  await run("scripts/migrate.mjs");
  await run("scripts/bootstrap-admin.mjs");
  await run("scripts/prepare-ocr.mjs");
  await run("node_modules/next/dist/bin/next", ["build"], appEnv);
  server = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/next/dist/bin/next"),
      "start",
      "--port",
      String(port),
      "--hostname",
      "127.0.0.1",
    ],
    { cwd: root, env: appEnv, stdio: "inherit", windowsHide: true },
  );
  await writeFile(
    stateFile,
    JSON.stringify({
      root,
      serverPid: server.pid,
      runnerPid: process.pid,
      port,
    }),
  );
  let healthy = false;
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null)
      throw new Error("Server stopped during startup");
    try {
      if ((await fetch(`http://localhost:${port}/api/health`)).ok) {
        healthy = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  if (!healthy) throw new Error("Server health check failed");
  for (const route of ["/", "/login", "/admin", "/plans", "/register-business"])
    await fetch(`http://localhost:${port}${route}`);
  console.log(
    `\nNUBRA ready: http://localhost:${port}\nAll routes compiled. Ctrl+C to stop.\n`,
  );
  preparing = undefined;
  await releaseStartupLock();
  await new Promise((r) => server.once("exit", r));
} finally {
  preparing?.kill();
  server?.kill();
  await releaseStartupLock();
  try {
    const state = JSON.parse(await readFile(stateFile, "utf8"));
    if (state.runnerPid === process.pid) await unlink(stateFile);
  } catch {}
}
