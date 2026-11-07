import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";

// As ações rodam fora do Next: o redirect vira um erro com o destino, e a guarda da
// moderação deixa passar só quem o teste escolher, como a de verdade faz com "acao".
const sessao = vi.hoisted(() => ({ moderador: null as { id: string } | null }));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`redirect:${destino}`);
  },
}));
vi.mock("@/lib/auth/sessao", () => ({
  exigirModerador: async () => {
    if (!sessao.moderador) throw new Error("redirect:/404");
    return { ...sessao.moderador, nome: "Moderação", email: "mod@exemplo.com", moderador: true, emailConfirmado: true };
  },
}));

const { liberarDonoParaClube, suspenderDonoDoClube } = await import("@/acoes/clube");
const { podeCriarOfertas, quemBateComAConta } = await import("@/lib/clube");

const CNPJ = "11222333000181";

/** A Receita de mentira: responde a ficha do CNPJ pedido, com a situação e os sócios do teste. */
function receitaCom(situacao: string, socios: string[] = ["DORA DONA DA SILVA"]) {
  const fetch = vi.fn(async () =>
    Response.json({
      razao_social: "PADARIA FLOR LTDA",
      nome_fantasia: "PADARIA FLOR",
      descricao_situacao_cadastral: situacao,
      municipio: "RECIFE",
      uf: "PE",
      qsa: socios.map((nome) => ({ nome_socio: nome, qualificacao_socio: "Sócio-Administrador" })),
      ddd_telefone_1: "8133334444",
      email: "CONTATO@PADARIAFLOR.COM.BR",
    }),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

async function limparBanco() {
  await db.$executeRawUnsafe(`TRUNCATE "RegistroAuditoria", "LiberacaoClube", "EmpresaMembro", "Empresa", "Usuario" CASCADE`);
}

function formulario(campos: Record<string, string>) {
  const dados = new FormData();
  for (const [nome, valor] of Object.entries(campos)) dados.set(nome, valor);
  return dados;
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

let moderador: { id: string };
let dona: { id: string };
let outra: { id: string };
let empresaId: string;

const liberar = (campos: Record<string, string> = {}) =>
  liberarDonoParaClube(formulario({ empresaId, usuarioId: dona.id, cnpj: "11.222.333/0001-81", ...campos }));
const liberacao = () => db.liberacaoClube.findUnique({ where: { empresaId_usuarioId: { empresaId, usuarioId: dona.id } } });
const auditoria = () => db.registroAuditoria.findMany({ where: { alvoId: empresaId }, orderBy: { criadoEm: "asc" } });

beforeEach(async () => {
  await limparBanco();
  moderador = await db.usuario.create({ data: { nome: "Mona Moderação", email: "mona@exemplo.com", papel: "moderador" } });
  dona = await db.usuario.create({ data: { nome: "Dora Dona", email: "dora@exemplo.com" } });
  outra = await db.usuario.create({ data: { nome: "Olga Outra", email: "olga@exemplo.com" } });
  const empresa = await db.empresa.create({
    data: {
      instagramUsername: "padaria.flor",
      nome: "Padaria Flor",
      resumo: "Um negócio do bem",
      categoria: "Café e padaria",
      cidade: "Recife",
      uf: "PE",
      moderacao: "aprovada",
      status: "verificada",
      membros: { create: { usuarioId: dona.id } },
    },
  });
  empresaId = empresa.id;
  sessao.moderador = moderador;
});
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => {
  await limparBanco();
  await db.$disconnect();
});

describe("liberar um dono para o clube", () => {
  it("com CNPJ ativo na Receita, libera, guarda o CNPJ sem pontuação e registra na auditoria", async () => {
    receitaCom("ATIVA");

    expect(await destino(liberar())).toBe("/moderacao/negocios/padaria.flor?aviso=clube_liberado#clube");
    expect(await liberacao()).toMatchObject({ cnpj: CNPJ, status: "liberada", motivo: null, decididoPorId: moderador.id });
    expect(await auditoria()).toMatchObject([
      { acao: "clube.liberado", usuarioId: moderador.id, detalhes: "@padaria.flor · Dora Dona · CNPJ 11.222.333/0001-81" },
    ]);
    expect(await podeCriarOfertas(empresaId, dona.id)).toBe(true);
  });

  it("confere a Receita no servidor e recusa CNPJ que não está ativo", async () => {
    receitaCom("BAIXADA");

    expect(await destino(liberar())).toBe("/moderacao/negocios/padaria.flor?aviso=clube_cnpj_inativo#clube");
    expect(await liberacao()).toBeNull();
    expect(await auditoria()).toHaveLength(0);
  });

  it("sem resposta da Receita, não libera", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("erro", { status: 502 })));

    expect(await destino(liberar())).toBe("/moderacao/negocios/padaria.flor?aviso=clube_receita_indisponivel#clube");
    expect(await liberacao()).toBeNull();
  });

  it("recusa um CNPJ com os dígitos errados, sem consultar a Receita", async () => {
    const fetch = receitaCom("ATIVA");

    expect(await destino(liberar({ cnpj: "11.222.333/0001-82" }))).toBe(
      "/moderacao/negocios/padaria.flor?aviso=clube_cnpj_invalido#clube",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("só libera quem é dono do negócio", async () => {
    receitaCom("ATIVA");

    expect(await destino(liberar({ usuarioId: outra.id }))).toBe("/moderacao/negocios/padaria.flor?aviso=clube_nao_e_dono#clube");
    expect(await db.liberacaoClube.count()).toBe(0);
  });

  it("quem não é da moderação é recusado sem gravar nada", async () => {
    receitaCom("ATIVA");
    sessao.moderador = null;

    expect(await destino(liberar())).toBe("/404");
    expect(await liberacao()).toBeNull();
  });
});

describe("suspender e liberar de novo", () => {
  it("suspende com o motivo, uma vez só, e a pessoa deixa de poder criar ofertas", async () => {
    receitaCom("ATIVA");
    await destino(liberar());
    const { id } = (await liberacao())!;

    const suspender = () => suspenderDonoDoClube(formulario({ liberacaoId: id, motivo: "Pediu Pix antecipado" }));
    expect(await destino(suspender())).toBe("/moderacao/negocios/padaria.flor?aviso=clube_suspenso#clube");
    expect(await destino(suspender())).toBe("/moderacao/negocios/padaria.flor?aviso=clube_suspenso#clube");

    expect(await liberacao()).toMatchObject({ status: "suspensa", motivo: "Pediu Pix antecipado" });
    expect((await auditoria()).map((registro) => registro.acao)).toEqual(["clube.liberado", "clube.suspenso"]);
    expect(await podeCriarOfertas(empresaId, dona.id)).toBe(false);
  });

  it("liberar de novo apaga o motivo da suspensão", async () => {
    receitaCom("ATIVA");
    await destino(liberar());
    await destino(suspenderDonoDoClube(formulario({ liberacaoId: (await liberacao())!.id, motivo: "Conferência" })));

    await destino(liberar());

    expect(await liberacao()).toMatchObject({ status: "liberada", motivo: null });
    expect(await db.liberacaoClube.count()).toBe(1);
  });

  it("quem deixa de ser dono perde a liberação", async () => {
    receitaCom("ATIVA");
    await destino(liberar());

    await db.empresaMembro.deleteMany({ where: { empresaId, usuarioId: dona.id } });

    expect(await podeCriarOfertas(empresaId, dona.id)).toBe(false);
  });
});

describe("com quem da ficha o nome da conta bate", () => {
  const ficha = (razaoSocial: string, socios: string[] = []) => ({
    razaoSocial,
    socios: socios.map((nome) => ({ nome, qualificacao: null })),
  });

  it("acha o sócio sem ligar para acento, maiúsculas, ordem nem nomes do meio", () => {
    expect(quemBateComAConta("Dora Dona", ficha("PADARIA FLOR LTDA", ["JOÃO SOUZA", "DORA MARIA DONA DA SILVA"]))).toBe(
      "DORA MARIA DONA DA SILVA",
    );
    expect(quemBateComAConta("José Antônio", ficha("X LTDA", ["ANTONIO JOSE PEREIRA"]))).toBe("ANTONIO JOSE PEREIRA");
  });

  it("no MEI, acha a pessoa na razão social, que traz o CPF", () => {
    expect(quemBateComAConta("Carla Moreira", ficha("CARLA MOREIRA DOS SANTOS 12345678900"))).toBe(
      "CARLA MOREIRA DOS SANTOS 12345678900",
    );
  });

  it("não bate com um nome só, nem com um sobrenome diferente", () => {
    expect(quemBateComAConta("Dora", ficha("X LTDA", ["DORA DONA"]))).toBeNull();
    expect(quemBateComAConta("Dora Souza", ficha("X LTDA", ["DORA DONA"]))).toBeNull();
  });
});
