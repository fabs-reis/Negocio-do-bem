import { Client } from "pg";
import { afterEach, expect, it, vi } from "vitest";

const simbolo = Symbol.for("__cloudflare-context__");
const globais = globalThis as unknown as Record<symbol, unknown>;
const anterior = globais[simbolo];

afterEach(() => {
  globais[simbolo] = anterior;
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("usa o mesmo esquema no ORM e na trava SQL com URLs diferentes", async () => {
  const url = process.env.TEST_DATABASE_URL!;
  const cliente = new Client({ connectionString: url });
  await cliente.connect();
  await cliente.query('CREATE SCHEMA IF NOT EXISTS "prova_hyperdrive"');
  await cliente.query('CREATE TABLE IF NOT EXISTS "prova_hyperdrive"."Usuario" (id text PRIMARY KEY)');
  const id = "prova-esquema-hyperdrive";
  await cliente.query('INSERT INTO public."Usuario" (id, nome, email, "senhaHash") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING', [id, "Prova", "prova-esquema-hyperdrive@exemplo.test", "fixture"]);
  await cliente.query('INSERT INTO "prova_hyperdrive"."Usuario" (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [`${id}-privado`]);
  const origem = new URL(url);
  origem.searchParams.set("schema", "prova_hyperdrive");
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("DATABASE_URL", origem.toString());
  vi.stubEnv("DEPLOY_ENV", "production");
  globais[simbolo] = { ctx: {}, env: { HYPERDRIVE: { connectionString: url } } };
  const { db, esquemaSql } = await import("@/lib/db");
  try {
    const usuario = await db.usuario.findUnique({ where: { id }, select: { id: true } });
    const travados = await db.$transaction((tx) => tx.$queryRaw<{ id: string }[]>`SELECT id FROM ${esquemaSql()}."Usuario" WHERE id = ${id} FOR NO KEY UPDATE`);
    expect(usuario).toEqual({ id });
    expect(travados).toEqual([{ id }]);
    const privado = `${id}-privado`;
    expect(await db.usuario.findUnique({ where: { id: privado }, select: { id: true } })).toBeNull();
    const travaPrivada = await db.$transaction((tx) => tx.$queryRaw<{ id: string }[]>`SELECT id FROM ${esquemaSql()}."Usuario" WHERE id = ${privado} FOR NO KEY UPDATE`);
    expect(travaPrivada).toEqual([]);
  } finally {
    await db.$disconnect();
    await cliente.query('DELETE FROM public."Usuario" WHERE id = $1', [id]);
    await cliente.query('DELETE FROM "prova_hyperdrive"."Usuario" WHERE id = $1', [`${id}-privado`]);
    await cliente.end();
  }
});
