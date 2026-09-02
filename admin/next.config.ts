import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const adminRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: adminRoot,
  },
};

export default nextConfig;
