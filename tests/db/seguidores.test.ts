import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";

// A Server Action roda fora do Next: o redirect vira um erro com o destino, a sessão
// devolve a conta que o teste escolher (ou manda para o login) e os eventos do
// Analytics ficam numa lista.
type Conta = { id: string; nome: string; email: string };
const sessao = vi.hoisted(() => ({ usuario: null as Conta | null }));
const eventos = vi.hoisted(() => [] as unknown[]);
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`redirect:${destino}`);
  },
}));
vi.mock("@/lib/auth/sessao", async (original) => ({
  ...(await original<typeof import("@/lib/auth/sessao")>()),
  exigirUsuario: async (voltar: string) => {
    if (!sessao.usuario) throw new Error(`redirect:/entrar?voltar=${encodeURIComponent(voltar)}`);
    return { ...sessao.usuario, moderador: false, emailConfirmado: true };
  },
}));
vi.mock("@/lib/medicao-servidor", () => ({ medir: async (evento: unknown) => void eventos.push(evento) }));

const { alternarSeguir } = await import("@/acoes/seguidores");

async function limparBanco() {
  await db.$executeRawUnsafe(
    `TRUNCATE "RegistroAuditoria", "Depoimento", "Reivindicacao", "EmpresaSeguidor", "EmpresaMembro", "EmpresaCausa", "Empresa", "Sessao", "Usuario" CASCADE`,
  );
}

/** Para onde a ação mandou a pessoa. */
async function destino(acao: Promise<void>): Promise<string> {
  try {
    await acao;
  } catch (erro) {
    if (erro instanceof Error && erro.message.startsWith("redirect:")) return erro.message.slice("redirect:".length);
    throw erro;
  }
  throw new Error("A ação não redirecionou.");
}

function formulario(campos: Record<string, string>) {
  const dados = new FormData();
  for (const [nome, valor] of Object.entries(campos)) dados.set(nome, valor);
  return dados;
}

let leitora: Conta;
let dona: Conta;
let empresaId: string;

const seguir = (campos: Record<string, string> = {}) => alternarSeguir(formulario({ empresaId, seguir: "sim", ...campos }));
const deixarDeSeguir = (campos: Record<string, string> = {}) => alternarSeguir(formulario({ empresaId, seguir: "nao", ...campos }));
const seguidores = () => db.empresaSeguidor.findMany({ where: { empresaId } });

beforeEach(async () => {
  await limparBanco();
  eventos.length = 0;
  leitora = await db.usuario.create({ data: { nome: "Lia Leitora", email: "lia@exemplo.com", senhaHash: "scrypt$segredo" } });
  dona = await db.usuario.create({ data: { nome: "Dora Dona", email: "dora@exemplo.com", senhaHash: "scrypt$segredo" } });
  const empresa = await db.empresa.create({
    data: {
      instagramUsername: "padaria.flor",
      nome: "Padaria Flor",
      resumo: "Um negócio do bem",
      categoria: "Café e padaria",
      cidade: "Recife",
      uf: "PE",
      moderacao: "aprovada",
      membros: { create: { usuarioId: dona.id } },
    },
  });
  empresaId = empresa.id;
  sessao.usuario = leitora;
});
afterAll(async () => {
  await limparBanco();
  await db.$disconnect();
});

describe("seguir um negócio", () => {
  it("segue um negócio do diretório, volta ao perfil com o aviso e conta no Analytics", async () => {
    expect(await destino(seguir())).toBe("/empresas/padaria.flor?aviso=seguindo");

    expect(await seguidores()).toMatchObject([{ usuarioId: leitora.id }]);
    expect(eventos).toEqual([{ nome: "negocio_seguido", params: { categoria: "Café e padaria", uf: "PE" } }]);
  });

  it("dois toques ao mesmo tempo gravam uma vez só e contam uma vez só", async () => {
    await Promise.allSettled([seguir(), seguir()]);
    expect(await destino(seguir())).toBe("/empresas/padaria.flor?aviso=seguindo");

    expect(await seguidores()).toHaveLength(1);
    expect(eventos).toHaveLength(1);
  });

  it("um negócio sem dono também pode ser seguido", async () => {
    await db.empresaMembro.deleteMany({ where: { empresaId } });

    expect(await destino(seguir())).toBe("/empresas/padaria.flor?aviso=seguindo");
    expect(await seguidores()).toHaveLength(1);
  });

  it("sem login, manda para o login e volta ao perfil", async () => {
    sessao.usuario = null;

    expect(await destino(seguir())).toBe(`/entrar?voltar=${encodeURIComponent("/empresas/padaria.flor")}`);
    expect(await seguidores()).toHaveLength(0);
  });

  it("a dona não segue o próprio negócio, mesmo chamando a ação direto", async () => {
    sessao.usuario = dona;

    expect(await destino(seguir())).toBe("/empresas/padaria.flor");
    expect(await seguidores()).toHaveLength(0);
    expect(eventos).toHaveLength(0);
  });

  it.each([
    ["oculto pelo dono", { oculta: true }],
    ["tirado do ar", { moderacao: "rejeitada" }],
  ])("não segue um negócio %s", async (_caso, dados) => {
    await db.empresa.update({ where: { id: empresaId }, data: dados });

    expect(await destino(seguir())).toBe("/empresas/padaria.flor");
    expect(await seguidores()).toHaveLength(0);
  });

  it("volta para a página Seguindo mantendo a página da lista", async () => {
    expect(await destino(seguir({ voltar: "/seguindo?pagina=2" }))).toBe("/seguindo?pagina=2&aviso=seguindo");
  });

  it("ignora um endereço de volta para outro site", async () => {
    expect(await destino(seguir({ voltar: "//golpe.example/seguindo" }))).toBe("/empresas/padaria.flor?aviso=seguindo");
  });
});

describe("deixar de seguir", () => {
  it("apaga só a linha de quem pediu", async () => {
    await db.empresaSeguidor.createMany({
      data: [
        { empresaId, usuarioId: leitora.id },
        { empresaId, usuarioId: dona.id },
      ],
    });

    expect(await destino(deixarDeSeguir({ voltar: "/seguindo" }))).toBe("/seguindo?aviso=deixou_de_seguir");
    expect(await seguidores()).toMatchObject([{ usuarioId: dona.id }]);
    expect(eventos).toHaveLength(0);
  });

  it("vale mesmo depois que o negócio saiu do diretório", async () => {
    await db.empresaSeguidor.create({ data: { empresaId, usuarioId: leitora.id } });
    await db.empresa.update({ where: { id: empresaId }, data: { oculta: true } });

    expect(await destino(deixarDeSeguir())).toBe("/empresas/padaria.flor?aviso=deixou_de_seguir");
    expect(await seguidores()).toHaveLength(0);
  });

  it("negócio que não existe volta para o início", async () => {
    expect(await destino(alternarSeguir(formulario({ empresaId: "nao-existe", seguir: "sim" })))).toBe("/");
  });
});
