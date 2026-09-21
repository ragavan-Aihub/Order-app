import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const adminRoot = path.dirname(fileURLToPath(import.meta.url));

function lanDevOrigins() {
  const origins = ["localhost", "127.0.0.1"];
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === "IPv4" && !addr.internal) {
        origins.push(addr.address);
      }
    }
  }
  return origins;
}

const nextConfig: NextConfig = {
  allowedDevOrigins: lanDevOrigins(),
  turbopack: {
    root: adminRoot,
  },
};

export default nextConfig;
