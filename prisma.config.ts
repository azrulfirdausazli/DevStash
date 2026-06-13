import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // DIRECT_URL = unpooled Neon endpoint. The Prisma CLI (migrate/db push/
    // introspect) needs a direct TCP connection. The pooled DATABASE_URL is
    // used at runtime by @prisma/adapter-neon over WebSocket.
    url: env("DIRECT_URL"),
  },
});
