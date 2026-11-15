import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { moderarServico, salvarPerfilProfissional, salvarServico } from "@/acoes/servicos";
import { db } from "@/lib/db";
import { normalizarEndereco } from "@/lib/instagram";

const sessao = vi.hoisted(() => ({
  usuario: null as { id: string; nome: string; email: string; moderador: boolean; emailConfirmado: boolean } | null,
  moderador: null as { id: string; nome: string; email: string; moderador: boolean; emailConfirmado: boolean } | null,
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string): never => { throw new Error("REDIRECT " + url); },
  notFound: (): never => { throw new Error("NOT_FOUND"); },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/sessao", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/sessao")>()),
  exigirUsuario: async () => {
    if (!sessao.usuario) throw new Error("Não autenticado.");
    return sessao.usuario;
  },
  exigirModerador: async () => {
    if (!sessao.moderador) throw new Error("Não é moderação.");
    return sessao.moderador;
  },
}));

const ids: string[] = [];
let dono: { id: string };
let moderador: { id: string };
let anuncioId: string;

function dados(form: Record<string, string>) {
  const resultado = new FormData();
  for (const [campo, valor] of Object.entries(form)) resultado.set(campo, valor);
  return resultado;
}

function edicaoServico(id: string, titulo: string) {
  return dados({
    id, prestador: "profissional", titulo,
    descricao: "Criação de sites personalizados para pequenos negócios, do início ao fim.",
    categoria: "Tecnologia", remoto: "sim", presencial: "nao",
    precoReferencia: "", areasAtendimento: "",
  });
}

function decisao(id: string, versao: number, tipo = "aprovar") {
  return dados({ id, versaoConteudo: String(versao), decisao: tipo });
}

async function redireciona(fn: () => Promise<unknown>, caminho: string) {
  await expect(fn()).rejects.toThrow("REDIRECT " + caminho);
}

beforeEach(async () => {
  const chave = randomUUID();
  dono = await db.usuario.create({
    data: { nome: "Pessoa Prestadora", email: "prestador-" + chave + "@example.com", senhaHash: "x", emailConfirmadoEm: new Date() },
  });
  ids.push(dono.id);
  moderador = await db.usuario.create({
    data: { nome: "Pessoa Moderadora", email: "moderacao-" + chave + "@example.com", senhaHash: "x", papel: "moderador" },
  });
  ids.push(moderador.id);
  sessao.usuario = { id: dono.id, nome: "Pessoa Prestadora", email: "prestador@example.com", moderador: false, emailConfirmado: true };
  sessao.moderador = { id: moderador.id, nome: "Pessoa Moderadora", email: "mod@example.com", moderador: true, emailConfirmado: true };
  await db.perfilProfissional.create({
    data: { usuarioId: dono.id, nomePublico: "Prestador", apresentacao: "Faço projetos para pequenos negócios.", cidade: "Recife", uf: "PE", remoto: true, emailContato: "pessoa@example.com", publicado: true },
  });
  const anuncio = await db.servico.create({
    data: {
      perfilUsuarioId: dono.id,
      titulo: "Serviço original",
      descricao: "Criação de sites personalizados para pequenos negócios, do início ao fim.",
      categoria: "Tecnologia", cidade: "Recife", uf: "PE", remoto: true,
      busca: "servico original tecnologia", status: "pendente",
    },
  });
  anuncioId = anuncio.id;
});

afterEach(async () => {
  await db.usuario.deleteMany({ where: { id: { in: ids.splice(0) } } });
  sessao.usuario = null;
  sessao.moderador = null;
});

afterAll(async () => { await db.$disconnect(); });

describe("ações reais de serviços e decisões de moderação", () => {
  it("recusa a aprovação de conteúdo alterado após a consulta do moderador", async () => {
    const abertura = await db.servico.findUniqueOrThrow({ where: { id: anuncioId } });
    await redireciona(() => salvarServico(undefined, edicaoServico(anuncioId, "Serviço totalmente atualizado")), "/meus-servicos?aviso=servico_enviado");
    const alterado = await db.servico.findUniqueOrThrow({ where: { id: anuncioId } });
    expect(alterado.versaoConteudo).toBe(abertura.versaoConteudo + 1);
    await redireciona(() => moderarServico(decisao(anuncioId, abertura.versaoConteudo)), "/moderacao/servicos?aviso=indisponivel");
    expect((await db.servico.findUniqueOrThrow({ where: { id: anuncioId } })).status).toBe("pendente");
    await redireciona(() => moderarServico(decisao(anuncioId, alterado.versaoConteudo)), "/moderacao/servicos?aviso=feito");
    expect((await db.servico.findUniqueOrThrow({ where: { id: anuncioId } })).status).toBe("publicado");
  });

  it("não aprova uma versão do anúncio quando o perfil muda durante a análise", async () => {
    const versao = (await db.servico.findUniqueOrThrow({ where: { id: anuncioId } })).versaoConteudo;
    await redireciona(() => salvarPerfilProfissional(undefined, dados({
      nomePublico: "Prestador atualizado", apresentacao: "Trabalho com tecnologia e criação de páginas para empresas.",
      municipio: "Olinda, PE", remoto: "sim", presencial: "nao",
      emailContato: "pessoa@example.com", site: "", publicado: "sim",
    })), "/meus-servicos?aviso=perfil_salvo");
    const atualizado = await db.servico.findUniqueOrThrow({ where: { id: anuncioId } });
    expect(atualizado.versaoConteudo).toBe(versao + 1);
    expect(atualizado.cidade).toBe("Olinda");
    await redireciona(() => moderarServico(decisao(anuncioId, versao)), "/moderacao/servicos?aviso=indisponivel");
  });

  it("só permite uma aprovação entre duas ações idênticas", async () => {
    const versao = (await db.servico.findUniqueOrThrow({ where: { id: anuncioId } })).versaoConteudo;
    const resultados = await Promise.allSettled([
      moderarServico(decisao(anuncioId, versao)), moderarServico(decisao(anuncioId, versao)),
    ]);
    const mensagens = resultados.map((resultado) => resultado.status === "rejected" ? String(resultado.reason) : "");
    expect(mensagens.filter((texto) => texto.includes("aviso=feito"))).toHaveLength(1);
    expect(mensagens.filter((texto) => texto.includes("aviso=indisponivel"))).toHaveLength(1);
    expect((await db.servico.findUniqueOrThrow({ where: { id: anuncioId } })).status).toBe("publicado");
  });

  it("guarda a justificativa de rejeição mesmo após o reenvio", async () => {
    const motivo = "O anúncio precisa esclarecer os serviços oferecidos.";
    const versao = (await db.servico.findUniqueOrThrow({ where: { id: anuncioId } })).versaoConteudo;
    await redireciona(() => moderarServico(dados({
      id: anuncioId, versaoConteudo: String(versao), decisao: "rejeitar", motivo,
    })), "/moderacao/servicos?aviso=feito");
    await redireciona(() => salvarServico(undefined, edicaoServico(anuncioId, "Anúncio com dados corrigidos")), "/meus-servicos?aviso=servico_enviado");

    const anuncio = await db.servico.findUniqueOrThrow({ where: { id: anuncioId } });
    expect(anuncio.status).toBe("pendente");
    expect(anuncio.motivoRecusa).toBeNull();
    const evento = await db.registroAuditoria.findFirstOrThrow({
      where: { alvoTipo: "servico", alvoId: anuncioId, acao: "servico.rejeitado" },
    });
    expect(evento.detalhes).toBe(`Motivo: ${motivo}`);
  });

  it("guarda a justificativa de suspensão mesmo após o reenvio", async () => {
    const motivo = "O anúncio foi suspenso por informações incorretas.";
    const versao = (await db.servico.findUniqueOrThrow({ where: { id: anuncioId } })).versaoConteudo;
    await redireciona(() => moderarServico(decisao(anuncioId, versao)), "/moderacao/servicos?aviso=feito");
    await redireciona(() => moderarServico(dados({
      id: anuncioId, versaoConteudo: String(versao), decisao: "suspender", motivo,
    })), "/moderacao/servicos?aviso=feito");
    await redireciona(() => salvarServico(undefined, edicaoServico(anuncioId, "Anúncio corrigido após suspensão")), "/meus-servicos?aviso=servico_enviado");

    const anuncio = await db.servico.findUniqueOrThrow({ where: { id: anuncioId } });
    expect(anuncio.status).toBe("pendente");
    expect(anuncio.motivoSuspensao).toBeNull();
    const evento = await db.registroAuditoria.findFirstOrThrow({
      where: { alvoTipo: "servico", alvoId: anuncioId, acao: "servico.suspenso" },
    });
    expect(evento.detalhes).toBe(`Motivo: ${motivo}`);
  });

  it("impede a edição do anúncio por outra conta", async () => {
    const outra = await db.usuario.create({
      data: { nome: "Terceira pessoa", email: "terceiro-" + randomUUID() + "@example.com", senhaHash: "x" },
    });
    ids.push(outra.id);
    sessao.usuario = { id: outra.id, nome: "Terceira pessoa", email: "terceiro@example.com", moderador: false, emailConfirmado: true };
    const resposta = await salvarServico(undefined, edicaoServico(anuncioId, "Serviço indevido"));
    expect(resposta?.erro).toBeTruthy();
    expect((await db.servico.findUniqueOrThrow({ where: { id: anuncioId } })).titulo).toBe("Serviço original");
  });
});

describe("rotas do painel", () => {
  it("não reserva identificadores válidos de empresas para a gestão de serviços", () => {
    expect(normalizarEndereco("servicos")).toBe("servicos");
    expect(existsSync(resolve("src/app/painel/servicos/page.tsx"))).toBe(false);
    expect(existsSync(resolve("src/app/meus-servicos/page.tsx"))).toBe(true);
    expect(existsSync(resolve("src/app/painel/[usuario]/page.tsx"))).toBe(true);
  });
});
