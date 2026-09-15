import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["exceljs", "@libsql/client"],
  outputFileTracingIncludes: {
    "*": ["./data/**/*.xlsx", "./src/data/dataset.json"],
  },
};

export default nextConfig;
