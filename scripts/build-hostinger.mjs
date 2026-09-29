import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
for (const args of [
  ["scripts/prepare-ocr.mjs"],
  [require.resolve("next/dist/bin/next"), "build"],
]) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      stdio: "inherit",
      windowsHide: true,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error("Deployment build failed")),
    );
  });
}
