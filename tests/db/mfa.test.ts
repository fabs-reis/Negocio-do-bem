import { createHmac } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  confirmarConfiguracaoMfa,
  iniciarConfiguracaoMfa,
  validarSegundoFator,
} from "@/acoes/mfa";
import { hashCodigoRecuperacao } from "@/lib/auth/mfa";
import { gerarHashSenha } from "@/lib/auth/senha";
import { db } from "@/lib/db";

// Exercita as Server Actions e as transações reais: apenas a camada HTTP do
// Next (headers, cookies e redirect) é substituída por uma sessão controlada.
const contexto = vi.hoisted(() => ({
  sessaoId: "",
  usuarioId: "",
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-vercel-forwarded-for": "203.0.113.47" }),
}));

vi.mock("next/navigation", () => ({
  redirect: (destino: string): never => { throw new Error(`redirect:${destino}`); },
}));

vi.mock("@/lib/auth/sessao", () => ({
  sessaoAtual: async () => {
    if (!contexto.sessaoId) return null;
    const { db: banco } = await import("@/lib/db");
    return banco.sessao.findUnique({
      where: { id: contexto.sessaoId },
      include: { usuario: true },
    });
  },
  caminhoSeguro: (_valor: unknown, padrao: string) => padrao,
  encerrarSessao: vi.fn(async () => {}),
}));

function formulario(nome: string, valor: string) {
  const dados = new FormData();
  dados.set(nome, valor);
  return dados;
}

function gerarTotp(segredo: string) {
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes: number[] = [];
  let bits = 0;
  let buffer = 0;
  for (const letra of segredo) {
    buffer = (buffer << 5) | alfabeto.indexOf(letra);
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >>> (bits -= 8)) & 0xff);
      buffer &= (1 << bits) - 1;
    }
  }
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const hmac = createHmac("sha1", Buffer.from(bytes)).update(contador).digest();
  const indice = hmac[hmac.length - 1]! & 15;
  const numero = (hmac.readUInt32BE(indice) & 0x7fffffff) % 1_000_000;
  return String(numero).padStart(6, "0");
}

async function limpar() {
  await db.$executeRawUnsafe(
    'TRUNCATE "MfaCodigoRecuperacao", "MfaLimite", "TentativaAcesso", "Sessao", "Usuario" CASCADE',
  );
}

async function ativarMfa() {
  const inicio = await iniciarConfiguracaoMfa(undefined, formulario("senha", "senha-muito-forte-123"));
  expect(inicio?.segredo).toMatch(/^[A-Z2-7]+$/);
  const usuario = await db.usuario.findUniqueOrThrow({ where: { id: contexto.usuarioId } });
  expect(usuario.mfaSegredoPendente).not.toBeNull();
  expect(usuario.mfaSegredoPendente).not.toContain(inicio!.segredo!);

  const confirmacao = await confirmarConfiguracaoMfa(undefined, formulario("codigo", gerarTotp(inicio!.segredo!)));
  expect(confirmacao?.codigos).toHaveLength(10);
  const habilitado = await db.usuario.findUniqueOrThrow({ where: { id: contexto.usuarioId } });
  expect(habilitado.mfaAtivadoEm).not.toBeNull();
  expect(habilitado.mfaSegredoPendente).toBeNull();
  expect(await db.mfaCodigoRecuperacao.count({ where: { usuarioId: contexto.usuarioId } })).toBe(10);
  return confirmacao!.codigos!;
}

beforeEach(async () => {
  await limpar();
  vi.stubEnv("MFA_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("CLOUDFLARE_DEPLOY", "0");
  const usuario = await db.usuario.create({
    data: {
      nome: "Pessoa moderadora",
      email: "mfa-pr255@exemplo.test",
      papel: "moderador",
      senhaHash: await gerarHashSenha("senha-muito-forte-123"),
    },
  });
  contexto.usuarioId = usuario.id;
  contexto.sessaoId = "sessao-pr255-testada";
  await db.sessao.create({
    data: {
      id: contexto.sessaoId,
      usuarioId: usuario.id,
      expiraEm: new Date(Date.now() + 8 * 60 * 60_000),
    },
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  contexto.usuarioId = "";
  contexto.sessaoId = "";
});

afterAll(async () => {
  await limpar();
  await db.$disconnect();
});

describe("MFA dos moderadores — integração PostgreSQL", () => {
  it("exige a senha atual, cifra o segredo, ativa MFA e guarda apenas hashes dos códigos", async () => {
    expect((await iniciarConfiguracaoMfa(undefined, formulario("senha", "senha-errada")))?.erro).toMatch(/Senha atual incorreta/);
    const codigos = await ativarMfa();
    const primeiroHash = hashCodigoRecuperacao(codigos[0]!);
    expect(await db.mfaCodigoRecuperacao.findFirst({ where: { hash: primeiroHash! } })).not.toBeNull();
    expect(await db.mfaCodigoRecuperacao.findFirst({ where: { hash: codigos[0]! } })).toBeNull();
  });

  it("consome um código de recuperação uma única vez mesmo com pedidos concorrentes", async () => {
    const codigos = await ativarMfa();
    await db.sessao.update({ where: { id: contexto.sessaoId }, data: { mfaVerificadoEm: null } });
    const requests = await Promise.allSettled([
      validarSegundoFator(undefined, formulario("codigo", codigos[0]!)),
      validarSegundoFator(undefined, formulario("codigo", codigos[0]!)),
    ]);
    const redirecionamentos = requests.filter(
      (r) => r.status === "rejected" && String(r.reason).includes("redirect:/moderacao"),
    );
    expect(redirecionamentos).toHaveLength(1);
    expect(requests.some((r) => r.status === "fulfilled" && r.value?.erro?.includes("já usado"))).toBe(true);
    expect(await db.mfaCodigoRecuperacao.count({ where: { usuarioId: contexto.usuarioId } })).toBe(9);
  });

  it("não consome códigos de recuperação quando a sessão expirou por inatividade", async () => {
    const codigos = await ativarMfa();
    await db.sessao.update({
      where: { id: contexto.sessaoId },
      data: { ultimaAtividadeEm: new Date(Date.now() - 16 * 60_000), mfaVerificadoEm: null },
    });
    const resultado = await validarSegundoFator(undefined, formulario("codigo", codigos[0]!));
    expect(resultado?.erro).toMatch(/sessão expirou/i);
    expect(await db.mfaCodigoRecuperacao.count({ where: { usuarioId: contexto.usuarioId } })).toBe(10);
  });
});
