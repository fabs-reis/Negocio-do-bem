import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  INTERVALO_ENTRE_PEDIDOS_MS,
  VALIDADE_MS,
  criarTokenDeRedefinicao,
  redefinirSenha,
  tokenDeRedefinicaoValido,
} from "@/lib/auth/redefinicao";
import { gerarHashSenha, verificarSenha } from "@/lib/auth/senha";
import { db } from "@/lib/db";
import { enviarEmail, type Email } from "@/lib/email";
import { avisarRedefinicaoDeSenha } from "@/lib/notificacoes";

// O token vai para um cookie; aqui só importam as regras do banco e o que vai no e-mail.
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/email", () => ({ envioLigado: vi.fn(() => true), enviarEmail: vi.fn(async () => true) }));

async function criarConta(email = "ana@exemplo.com", senha = "senha-antiga-123") {
  return db.usuario.create({ data: { nome: "Ana Souza", email, senhaHash: await gerarHashSenha(senha) } });
}

async function abrirSessao(usuarioId: string) {
  await db.sessao.create({ data: { id: `sessao-${Math.random()}`, usuarioId, expiraEm: new Date(Date.now() + VALIDADE_MS) } });
}

/** Deixa o link do banco com a idade pedida, para testar o intervalo e a validade. */
async function envelhecer(usuarioId: string, ms: number) {
  await db.redefinicaoSenha.updateMany({
    where: { usuarioId },
    data: { criadoEm: new Date(Date.now() - ms), expiraEm: new Date(Date.now() - ms + VALIDADE_MS) },
  });
}

beforeEach(async () => {
  await db.$executeRawUnsafe(`TRUNCATE "RedefinicaoSenha", "Sessao", "Usuario" CASCADE`);
  vi.mocked(enviarEmail).mockClear();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("criarTokenDeRedefinicao", () => {
  it("guarda só o hash do token", async () => {
    const ana = await criarConta();
    const token = await criarTokenDeRedefinicao(ana.id);
    expect(token).toBeTruthy();
    const [registro] = await db.redefinicaoSenha.findMany();
    expect(registro!.id).not.toBe(token);
    expect(registro!.usuarioId).toBe(ana.id);
    expect(await tokenDeRedefinicaoValido(token!)).toBe(true);
  });

  it("não manda outro link em menos de um minuto", async () => {
    const ana = await criarConta();
    expect(await criarTokenDeRedefinicao(ana.id)).toBeTruthy();
    expect(await criarTokenDeRedefinicao(ana.id)).toBeNull();
    expect(await db.redefinicaoSenha.count()).toBe(1);
  });

  it("um link novo invalida o anterior", async () => {
    const ana = await criarConta();
    const primeiro = (await criarTokenDeRedefinicao(ana.id))!;
    await envelhecer(ana.id, INTERVALO_ENTRE_PEDIDOS_MS + 1000);
    const segundo = (await criarTokenDeRedefinicao(ana.id))!;
    expect(await tokenDeRedefinicaoValido(primeiro)).toBe(false);
    expect(await tokenDeRedefinicaoValido(segundo)).toBe(true);
    expect(await db.redefinicaoSenha.count()).toBe(1);
  });

  it("o intervalo vale para cada conta separadamente", async () => {
    const ana = await criarConta();
    const bia = await criarConta("bia@exemplo.com");
    expect(await criarTokenDeRedefinicao(ana.id)).toBeTruthy();
    expect(await criarTokenDeRedefinicao(bia.id)).toBeTruthy();
  });
});

describe("tokenDeRedefinicaoValido", () => {
  it("recusa token inexistente e link vencido", async () => {
    const ana = await criarConta();
    expect(await tokenDeRedefinicaoValido("qualquer-coisa")).toBe(false);
    const token = (await criarTokenDeRedefinicao(ana.id))!;
    await envelhecer(ana.id, VALIDADE_MS + 1000);
    expect(await tokenDeRedefinicaoValido(token)).toBe(false);
  });
});

describe("redefinirSenha", () => {
  it("troca a senha e encerra todas as sessões da conta", async () => {
    const ana = await criarConta();
    const bia = await criarConta("bia@exemplo.com");
    await abrirSessao(ana.id);
    await abrirSessao(ana.id);
    await abrirSessao(bia.id);
    const token = (await criarTokenDeRedefinicao(ana.id))!;

    expect(await redefinirSenha(token, "senha-nova-456")).toBe(true);

    const depois = await db.usuario.findUniqueOrThrow({ where: { id: ana.id } });
    expect(await verificarSenha("senha-nova-456", depois.senhaHash)).toBe(true);
    expect(await verificarSenha("senha-antiga-123", depois.senhaHash)).toBe(false);
    expect(await db.sessao.count({ where: { usuarioId: ana.id } })).toBe(0);
    expect(await db.sessao.count({ where: { usuarioId: bia.id } })).toBe(1);
  });

  it("o link vale uma vez só", async () => {
    const ana = await criarConta();
    const token = (await criarTokenDeRedefinicao(ana.id))!;
    expect(await redefinirSenha(token, "senha-nova-456")).toBe(true);
    expect(await redefinirSenha(token, "outra-senha-789")).toBe(false);
    const depois = await db.usuario.findUniqueOrThrow({ where: { id: ana.id } });
    expect(await verificarSenha("senha-nova-456", depois.senhaHash)).toBe(true);
  });

  it("dois envios ao mesmo tempo: só um troca a senha", async () => {
    const ana = await criarConta();
    const token = (await criarTokenDeRedefinicao(ana.id))!;
    const resultados = await Promise.all([redefinirSenha(token, "senha-nova-456"), redefinirSenha(token, "outra-senha-789")]);
    expect(resultados.filter(Boolean)).toHaveLength(1);
  });

  it("não troca a senha com link vencido ou inexistente", async () => {
    const ana = await criarConta();
    const token = (await criarTokenDeRedefinicao(ana.id))!;
    await envelhecer(ana.id, VALIDADE_MS + 1000);
    expect(await redefinirSenha(token, "senha-nova-456")).toBe(false);
    expect(await redefinirSenha("nao-existe", "senha-nova-456")).toBe(false);
    const depois = await db.usuario.findUniqueOrThrow({ where: { id: ana.id } });
    expect(await verificarSenha("senha-antiga-123", depois.senhaHash)).toBe(true);
  });

  it("o link de uma conta não troca a senha de outra", async () => {
    const ana = await criarConta();
    const bia = await criarConta("bia@exemplo.com", "senha-da-bia-123");
    const token = (await criarTokenDeRedefinicao(ana.id))!;
    await redefinirSenha(token, "senha-nova-456");
    const depois = await db.usuario.findUniqueOrThrow({ where: { id: bia.id } });
    expect(await verificarSenha("senha-da-bia-123", depois.senhaHash)).toBe(true);
  });
});

describe("avisarRedefinicaoDeSenha", () => {
  it("manda o link só para o e-mail da conta, sem a senha nem o hash", async () => {
    const ana = await criarConta();
    await avisarRedefinicaoDeSenha(ana.id, "token-de-teste");
    expect(enviarEmail).toHaveBeenCalledTimes(1);
    const email = vi.mocked(enviarEmail).mock.calls[0]![0] as Email;
    expect(email.para).toBe("ana@exemplo.com");
    expect(email.texto).toContain("/api/redefinir-senha?token=token-de-teste");
    expect(email.texto).toContain("Olá, Ana!");
    expect(email.texto).not.toContain("scrypt");
  });
});
