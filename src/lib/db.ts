import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { configuracaoDoBanco, identificadorSql } from "@/lib/banco";

export type { Prisma } from "@/generated/prisma/client";

const banco = configuracaoDoBanco(process.env.DATABASE_URL, process.env.VERCEL_ENV, process.env.VERCEL_DEPLOYMENT_ID);

// SQL bruto precisa de qualificação explícita: pools transacionais não garantem search_path.
export const esquemaSql = Prisma.raw(identificadorSql(banco.esquema));

// Em desenvolvimento o Next recarrega os módulos a cada mudança; guardar o
// cliente no globalThis evita abrir um pool de conexões novo a cada recarga.
const cache = globalThis as unknown as { prisma?: PrismaClient };

function criarCliente() {
  const adapter = new PrismaPg({ connectionString: banco.url }, { schema: banco.esquema });
  return new PrismaClient({ adapter });
}

export const db = cache.prisma ?? criarCliente();

if (process.env.NODE_ENV !== "production") cache.prisma = db;
