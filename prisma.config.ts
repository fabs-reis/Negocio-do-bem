import "dotenv/config";
import { defineConfig } from "prisma/config";
import { configuracaoDoBanco } from "./src/lib/banco";

const banco = configuracaoDoBanco(process.env.DATABASE_URL, process.env.VERCEL_ENV, process.env.VERCEL_DEPLOYMENT_ID);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: banco.url,
  },
});
