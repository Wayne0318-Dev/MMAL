import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.DOCKER_BUILD === "1" ? { output: "standalone" as const } : {}),
  serverExternalPackages: ["exceljs", "@libsql/client"],
  outputFileTracingIncludes: {
    "*": ["./data/**/*.xlsx", "./src/data/dataset.json"],
  },
};

export default nextConfig;
