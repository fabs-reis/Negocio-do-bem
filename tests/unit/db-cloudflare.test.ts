import { createHash } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";

const adaptadores = vi.hoisted(() => [] as { conexao: { connectionString?: string }; opcoes: { schema?: string } }[]);
vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: class {
    constructor(conexao: { connectionString?: string }, opcoes: { schema?: string }) {
      adaptadores.push({ conexao, opcoes });
    }
  },
}));
vi.mock("@/generated/prisma/client", () => ({
  Prisma: { raw: (valor: string) => valor },
  PrismaClient: class { usuario = {}; },
}));

const contexto = Symbol.for("__cloudflare-context__");
const globais = globalThis as unknown as Record<symbol, unknown>;
const anterior = globais[contexto];

afterEach(() => {
  globais[contexto] = anterior;
  adaptadores.length = 0;
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("recusa preview sem identidade em vez de usar public", async () => {
  vi.stubEnv("DEPLOY_ENV", "preview");
  vi.stubEnv("BANCO_PREVIEW_AMBIENTE", "");
  vi.stubEnv("BANCO_PREVIEW_ID", "");
  vi.stubEnv("DATABASE_URL", "postgresql://origem/negocio_do_bem_teste");
  const { db } = await import("@/lib/db");
  expect(() => db.usuario).toThrow();
});

it("recusa identidade Vercel em contexto Cloudflare", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("BANCO_PREVIEW_AMBIENTE", "preview");
  vi.stubEnv("BANCO_PREVIEW_PROVEDOR", "vercel");
  vi.stubEnv("BANCO_PREVIEW_ID", "dpl_Anterior123");
  globais[contexto] = { ctx: {}, env: { HYPERDRIVE: { connectionString: "postgresql://hyperdrive/negocio_do_bem_teste" } } };
  const { db } = await import("@/lib/db");
  expect(() => db.usuario).toThrow();
});

it("recusa identidade Cloudflare no runtime Vercel", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("DEPLOY_ENV", "");
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("BANCO_PREVIEW_AMBIENTE", "preview");
  vi.stubEnv("BANCO_PREVIEW_PROVEDOR", "cloudflare");
  vi.stubEnv("BANCO_PREVIEW_ID", "11111111-1111-4111-8111-111111111111");
  const { db } = await import("@/lib/db");
  expect(() => db.usuario).toThrow();
});

it("aceita identidade Vercel no runtime Vercel", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("DEPLOY_ENV", "");
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("BANCO_PREVIEW_AMBIENTE", "preview");
  vi.stubEnv("BANCO_PREVIEW_PROVEDOR", "vercel");
  vi.stubEnv("BANCO_PREVIEW_ID", "dpl_Anterior123");
  vi.stubEnv("DATABASE_URL", "postgresql://origem/negocio_do_bem_teste");
  const { db } = await import("@/lib/db");
  expect(db.usuario).toBeDefined();
});

it("usa Hyperdrive sem DATABASE_URL", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("DEPLOY_ENV", "production");
  globais[contexto] = { ctx: {}, env: { HYPERDRIVE: { connectionString: "postgresql://hyperdrive/negocio_do_bem_teste?schema=privado" } } };
  const { db, esquemaSql } = await import("@/lib/db");
  expect(db.usuario).toBeDefined();
  expect(adaptadores[0].opcoes.schema).toBe("privado");
  expect(esquemaSql()).toBe('"privado"');
});

it("usa o esquema explícito do cliente direto", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("DEPLOY_ENV", "production");
  vi.stubEnv("DATABASE_URL", "postgresql://origem/negocio_do_bem_teste?schema=privado");
  globais[contexto] = undefined;
  const { db, esquemaSql } = await import("@/lib/db");
  expect(db.usuario).toBeDefined();
  expect(adaptadores[0].opcoes.schema).toBe("privado");
  expect(esquemaSql()).toBe('"privado"');
});

it("usa o esquema explícito correspondente no Hyperdrive", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("DEPLOY_ENV", "production");
  vi.stubEnv("DATABASE_URL", "postgresql://origem/negocio_do_bem_teste?schema=privado");
  globais[contexto] = { ctx: {}, env: { HYPERDRIVE: { connectionString: "postgresql://hyperdrive/negocio_do_bem_teste?schema=privado" } } };
  const { db, esquemaSql } = await import("@/lib/db");
  expect(db.usuario).toBeDefined();
  expect(adaptadores[0].opcoes.schema).toBe("privado");
  expect(esquemaSql()).toBe('"privado"');
});

it("isola o cliente por requisição e aplica o esquema ao Hyperdrive", async () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const esquema = `preview_${createHash("sha256").update(id).digest("hex").slice(0, 55)}`;
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("DEPLOY_ENV", "preview");
  vi.stubEnv("BANCO_PREVIEW_AMBIENTE", "");
  vi.stubEnv("BANCO_PREVIEW_PROVEDOR", "cloudflare");
  vi.stubEnv("BANCO_PREVIEW_ID", id);
  vi.stubEnv("DATABASE_URL", "postgresql://origem/negocio_do_bem_teste");
  const primeira = {};
  globais[contexto] = { ctx: primeira, env: { HYPERDRIVE: { connectionString: "postgresql://hyperdrive/negocio_do_bem_teste" } } };
  const { db } = await import("@/lib/db");
  const usuario = db.usuario;
  expect(db.usuario).toBe(usuario);
  expect(adaptadores).toHaveLength(1);
  expect(new URL(adaptadores[0].conexao.connectionString!).hostname).toBe("hyperdrive");
  expect(new URL(adaptadores[0].conexao.connectionString!).searchParams.get("schema")).toBe(esquema);
  expect(adaptadores[0].opcoes.schema).toBe(esquema);
  globais[contexto] = { ctx: {}, env: { HYPERDRIVE: { connectionString: "postgresql://hyperdrive/negocio_do_bem_teste" } } };
  expect(db.usuario).not.toBe(usuario);
  expect(adaptadores).toHaveLength(2);
});
