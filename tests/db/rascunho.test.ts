import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { apagarRascunho, guardarRascunho, rascunhoDe } from "@/lib/rascunho";

async function limparBanco() {
  await db.$executeRawUnsafe(`TRUNCATE "RascunhoCadastro", "Usuario" CASCADE`);
}

beforeEach(limparBanco);
afterAll(async () => {
  await limparBanco();
  await db.$disconnect();
});

describe("rascunho do cadastro", () => {
  it("guarda, troca e apaga o rascunho da conta", async () => {
    const pessoa = await db.usuario.create({ data: { nome: "Pessoa", email: "rascunho@exemplo.com", senhaHash: "x" } });

    expect(await guardarRascunho(pessoa.id, { instagram: "padaria.flor", nome: "Padaria" })).toBe(true);
    expect(await guardarRascunho(pessoa.id, { instagram: "padaria.flor", nome: "Padaria Flor", causas: ["sustentavel"] })).toBe(true);
    expect(await rascunhoDe(pessoa.id)).toEqual({ instagram: "padaria.flor", nome: "Padaria Flor", causas: ["sustentavel"] });

    await apagarRascunho(pessoa.id);
    expect(await rascunhoDe(pessoa.id)).toBeNull();
  });

  it("não guarda um rascunho vazio", async () => {
    const pessoa = await db.usuario.create({ data: { nome: "Pessoa", email: "vazio@exemplo.com", senhaHash: "x" } });

    expect(await guardarRascunho(pessoa.id, { senha: "segredo" })).toBe(false);
    expect(await db.rascunhoCadastro.count()).toBe(0);
  });

  it("depois de 30 dias, o rascunho some", async () => {
    const pessoa = await db.usuario.create({ data: { nome: "Pessoa", email: "antigo@exemplo.com", senhaHash: "x" } });
    await guardarRascunho(pessoa.id, { nome: "Padaria" });
    await db.$executeRawUnsafe(`UPDATE "RascunhoCadastro" SET "atualizadoEm" = now() - interval '31 days'`);

    expect(await rascunhoDe(pessoa.id)).toBeNull();
    expect(await db.rascunhoCadastro.count()).toBe(0);
  });
});
