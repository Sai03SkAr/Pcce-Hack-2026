import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false, // the floating dev badge sits over the phone tab bar during demos
  serverExternalPackages: ["@libsql/client", "libsql"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
