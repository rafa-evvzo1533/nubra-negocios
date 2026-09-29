import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
if (process.env.DEPLOYMENT_TARGET === "hostinger")
  await import("./start-hostinger.mjs");
else await import("./start.mjs");
