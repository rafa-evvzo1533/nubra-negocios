import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A production build must not replace chunks served by a running dev server.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};

export default nextConfig;
