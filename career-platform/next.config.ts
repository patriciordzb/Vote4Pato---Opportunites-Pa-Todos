import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships a WASM Postgres build and pg uses optional native bindings;
  // both must be loaded by Node at runtime instead of being bundled.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  // Migrations are read from disk at runtime, so ship them with every function.
  outputFileTracingIncludes: { "/**": ["./db/migrations/*.sql"] },
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
