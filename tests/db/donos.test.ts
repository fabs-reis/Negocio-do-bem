import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  confirmarDono,
  donosSemConfirmacao,
  LOTE_DE_PEDIDOS,
  marcarPedidoDeConfirmacao,
  PRAZO_CONFIRMACAO_DIAS,
  pedirConfirmacaoATodos,
  removerDonosVencidos,
} from "@/lib/donos";
import {
  aprovar,
  confirmarCodigo,
  iniciarPorCodigoDm,
  processarLoginInstagram,
  solicitarPorDocumento,
} from "@/lib/reivindicacao";

const DIA = 24 * 60 * 60 * 1000;

async function limparBanco() {
  await db.$executeRawUnsafe(
    `TRUNCATE "RegistroAuditoria", "Depoimento", "Reivindicacao", "EmpresaMembro", "EmpresaCausa", "Empresa", "Sessao", "Usuario" CASCADE`,
  );
}

let contador = 0;
async function criarUsuario(nome = "Pessoa") {
  contador++;
  return db.usuario.create({ data: { nome, email: `dono${contador}@exemplo.com`, senhaHash: "x" } });
}

async function criarEmpresa(username: string) {
  return db.empresa.create({
    data: {
      instagramUsername: username,
      nome: `Negócio ${username}`,
      resumo: "Um negócio do bem",
      categoria: "Serviços",
      cidade: "Recife",
      uf: "PE",
      moderacao: "aprovada",
    },
  });
}

/** Um dono de antes da #133: assumiu pelos dados do negócio, na hora, sem confirmar. */
async function donoSemConfirmacao(empresaId: string, usuarioId: string, extra: { confirmacaoPedidaEm?: Date } = {}) {
  await db.empresaMembro.create({ data: { empresaId, usuarioId, ...extra } });
  await db.empresa.update({ where: { id: empresaId }, data: { status: "verificada" } });
}

async function membro(empresaId: string, usuarioId: string) {
  return db.empresaMembro.findUnique({ where: { empresaId_usuarioId: { empresaId, usuarioId } } });
}

async function donos(empresaId: string) {
  return (await db.empresaMembro.findMany({ where: { empresaId } })).map((m) => m.usuarioId).sort();
}

const dadosDoNegocio = { cnpj: null, site: null, relacao: "Dona", contato: "(81) 99999-0000", mensagem: null };

beforeEach(limparBanco);
afterAll(async () => {
  await limparBanco();
  await db.$disconnect();
});

describe("quem fica confirmado na aprovação", () => {
  it("confirma quem cola o código certo", async () => {
    const pessoa = await criarUsuario();
    const empresa = await criarEmpresa("padaria.flor");
    const { codigo } = await iniciarPorCodigoDm(empresa.id, pessoa.id);

    await confirmarCodigo({ empresaId: empresa.id, usuarioId: pessoa.id, texto: codigo! });

    expect((await membro(empresa.id, pessoa.id))?.confirmadoEm).not.toBeNull();
  });

  it("confirma quem a moderação aprova pela análise manual", async () => {
    const [pessoa, moderador] = await Promise.all(["Pessoa", "Moderação"].map((nome) => criarUsuario(nome)));
    const empresa = await criarEmpresa("padaria.flor");
    const pedido = await solicitarPorDocumento({ empresaId: empresa.id, usuarioId: pessoa.id, ...dadosDoNegocio });

    await aprovar({ reivindicacaoId: pedido.id, revisorId: moderador.id });

    expect((await membro(empresa.id, pessoa.id))?.confirmadoEm).not.toBeNull();
  });

  it("o dono sem confirmação pode pedir a análise manual, e a aprovação confirma", async () => {
    const [pessoa, moderador] = await Promise.all(["Pessoa", "Moderação"].map((nome) => criarUsuario(nome)));
    const empresa = await criarEmpresa("padaria.flor");
    await donoSemConfirmacao(empresa.id, pessoa.id);

    const pedido = await solicitarPorDocumento({ empresaId: empresa.id, usuarioId: pessoa.id, ...dadosDoNegocio });
    await aprovar({ reivindicacaoId: pedido.id, revisorId: moderador.id });

    expect((await membro(empresa.id, pessoa.id))?.confirmadoEm).not.toBeNull();
  });

  it("o dono sem confirmação confirma pelo código, mesmo num perfil já oficial", async () => {
    const [confirmada, socia] = await Promise.all(["Confirmada", "Sócia"].map((nome) => criarUsuario(nome)));
    const empresa = await criarEmpresa("padaria.flor");
    await db.empresaMembro.create({ data: { empresaId: empresa.id, usuarioId: confirmada.id, confirmadoEm: new Date() } });
    await db.empresaMembro.create({ data: { empresaId: empresa.id, usuarioId: socia.id } });
    await db.empresa.update({ where: { id: empresa.id }, data: { status: "verificada", oficial: true } });

    // Com uma sócia confirmada, o código certo vai para a moderação, que aprova.
    const pedido = await iniciarPorCodigoDm(empresa.id, socia.id);
    expect(await confirmarCodigo({ empresaId: empresa.id, usuarioId: socia.id, texto: pedido.codigo! })).toBe("em_analise");
    await aprovar({ reivindicacaoId: pedido.id, revisorId: confirmada.id });

    expect((await membro(empresa.id, socia.id))?.confirmadoEm).not.toBeNull();
    expect(await donos(empresa.id)).toEqual([confirmada.id, socia.id].sort());
  });
});

describe("quem confirma pelo Instagram passa na frente", () => {
  it("pelo código: o dono que nunca confirmou sai, sem conflito, e fica na auditoria", async () => {
    const [antiga, nova] = await Promise.all(["Antiga", "Nova"].map((nome) => criarUsuario(nome)));
    const empresa = await criarEmpresa("padaria.flor");
    await donoSemConfirmacao(empresa.id, antiga.id);
    const { codigo } = await iniciarPorCodigoDm(empresa.id, nova.id);

    expect(await confirmarCodigo({ empresaId: empresa.id, usuarioId: nova.id, texto: codigo! })).toBe("aprovada");

    expect(await donos(empresa.id)).toEqual([nova.id]);
    expect((await db.empresa.findUniqueOrThrow({ where: { id: empresa.id } })).oficial).toBe(true);
    expect(await db.registroAuditoria.findFirst({ where: { acao: "empresa.dono_removido" } })).toMatchObject({
      alvoId: empresa.id,
      usuarioId: null,
    });
  });

  it("pelo Entrar com Instagram: o mesmo", async () => {
    const [antiga, nova] = await Promise.all(["Antiga", "Nova"].map((nome) => criarUsuario(nome)));
    const empresa = await criarEmpresa("casa.do_bem");
    await donoSemConfirmacao(empresa.id, antiga.id);

    const resultado = await processarLoginInstagram({
      empresaId: empresa.id,
      usuarioId: nova.id,
      conta: { userId: "id-casa", username: "casa.do_bem" },
    });

    expect(resultado).toEqual({ tipo: "verificada" });
    expect(await donos(empresa.id)).toEqual([nova.id]);
  });

  it("com um dono confirmado, o código certo continua com a moderação", async () => {
    const [confirmada, nova] = await Promise.all(["Confirmada", "Nova"].map((nome) => criarUsuario(nome)));
    const empresa = await criarEmpresa("padaria.flor");
    await db.empresaMembro.create({ data: { empresaId: empresa.id, usuarioId: confirmada.id, confirmadoEm: new Date() } });
    const { codigo } = await iniciarPorCodigoDm(empresa.id, nova.id);

    expect(await confirmarCodigo({ empresaId: empresa.id, usuarioId: nova.id, texto: codigo! })).toBe("em_analise");
    expect(await donos(empresa.id)).toEqual([confirmada.id]);
  });

  it("a moderação aprovando a análise manual de outra pessoa não tira ninguém", async () => {
    const [antiga, nova, moderador] = await Promise.all(["Antiga", "Nova", "Moderação"].map((nome) => criarUsuario(nome)));
    const empresa = await criarEmpresa("padaria.flor");
    await donoSemConfirmacao(empresa.id, antiga.id);
    const pedido = await solicitarPorDocumento({ empresaId: empresa.id, usuarioId: nova.id, ...dadosDoNegocio });

    await aprovar({ reivindicacaoId: pedido.id, revisorId: moderador.id, modo: "adicionar" });

    expect(await donos(empresa.id)).toEqual([antiga.id, nova.id].sort());
  });
});

describe("pedido de confirmação e prazo", () => {
  it("o pedido marca só uma vez e fica na auditoria", async () => {
    const [pessoa, moderador] = await Promise.all(["Pessoa", "Moderação"].map((nome) => criarUsuario(nome)));
    const empresa = await criarEmpresa("padaria.flor");
    await donoSemConfirmacao(empresa.id, pessoa.id);

    expect(await marcarPedidoDeConfirmacao({ empresaId: empresa.id, usuarioId: pessoa.id, moderadorId: moderador.id })).toBe(true);
    expect(await marcarPedidoDeConfirmacao({ empresaId: empresa.id, usuarioId: pessoa.id, moderadorId: moderador.id })).toBe(false);

    expect((await membro(empresa.id, pessoa.id))?.confirmacaoPedidaEm).not.toBeNull();
    expect(await db.registroAuditoria.count({ where: { acao: "empresa.confirmacao_pedida" } })).toBe(1);
  });

  it("não pede a quem já confirmou", async () => {
    const [pessoa, moderador] = await Promise.all(["Pessoa", "Moderação"].map((nome) => criarUsuario(nome)));
    const empresa = await criarEmpresa("padaria.flor");
    await db.empresaMembro.create({ data: { empresaId: empresa.id, usuarioId: pessoa.id, confirmadoEm: new Date() } });

    expect(await marcarPedidoDeConfirmacao({ empresaId: empresa.id, usuarioId: pessoa.id, moderadorId: moderador.id })).toBe(false);
  });

  it("pedir a todos marca um lote de quem ainda não recebeu", async () => {
    const moderador = await criarUsuario("Moderação");
    const jaPedido = await criarUsuario("Já pedido");
    const empresas = await Promise.all(Array.from({ length: LOTE_DE_PEDIDOS + 2 }, (_, i) => criarEmpresa(`lote.${i}`)));
    const pessoas = await Promise.all(empresas.map((_, i) => criarUsuario(`Pessoa ${i}`)));
    for (let i = 0; i < empresas.length; i++) await donoSemConfirmacao(empresas[i]!.id, pessoas[i]!.id);
    const outra = await criarEmpresa("ja.pedido");
    await donoSemConfirmacao(outra.id, jaPedido.id, { confirmacaoPedidaEm: new Date() });

    const marcados = await pedirConfirmacaoATodos(moderador.id);

    expect(marcados).toHaveLength(LOTE_DE_PEDIDOS);
    expect(marcados.some((m) => m.usuarioId === jaPedido.id)).toBe(false);
    expect(await db.empresaMembro.count({ where: { confirmacaoPedidaEm: null } })).toBe(2);
  });

  it("a moderação confirma quem ela conhece", async () => {
    const [pessoa, moderador] = await Promise.all(["Pessoa", "Moderação"].map((nome) => criarUsuario(nome)));
    const empresa = await criarEmpresa("padaria.flor");
    await donoSemConfirmacao(empresa.id, pessoa.id);

    expect(await confirmarDono({ empresaId: empresa.id, usuarioId: pessoa.id, moderadorId: moderador.id })).toBe(true);

    expect((await membro(empresa.id, pessoa.id))?.confirmadoEm).not.toBeNull();
    expect(await db.registroAuditoria.findFirst({ where: { acao: "empresa.dono_confirmado" } })).toMatchObject({ usuarioId: moderador.id });
    expect(await donosSemConfirmacao()).toEqual([]);
  });

  it("a remoção só tira quem passou do prazo sem pedido em andamento", async () => {
    const moderador = await criarUsuario("Moderação");
    const [venceu, dentroDoPrazo, semPedido, comCodigo, comAnalise, coDona, confirmada] = await Promise.all(
      ["Venceu", "No prazo", "Sem pedido", "Com código", "Com análise", "Co-dona", "Confirmada"].map((nome) => criarUsuario(nome)),
    );
    const vencido = new Date(Date.now() - (PRAZO_CONFIRMACAO_DIAS + 1) * DIA);
    const recente = new Date(Date.now() - DIA);
    const sozinha = await criarEmpresa("venceu.sozinha");
    const noPrazo = await criarEmpresa("no.prazo");
    const naoPedido = await criarEmpresa("nao.pedido");
    const codigo = await criarEmpresa("com.codigo");
    const analise = await criarEmpresa("com.analise");
    const compartilhada = await criarEmpresa("com.co-dona");
    await donoSemConfirmacao(sozinha.id, venceu.id, { confirmacaoPedidaEm: vencido });
    await donoSemConfirmacao(noPrazo.id, dentroDoPrazo.id, { confirmacaoPedidaEm: recente });
    await donoSemConfirmacao(naoPedido.id, semPedido.id);
    await donoSemConfirmacao(codigo.id, comCodigo.id, { confirmacaoPedidaEm: vencido });
    await iniciarPorCodigoDm(codigo.id, comCodigo.id);
    await donoSemConfirmacao(analise.id, comAnalise.id, { confirmacaoPedidaEm: vencido });
    await solicitarPorDocumento({ empresaId: analise.id, usuarioId: comAnalise.id, ...dadosDoNegocio });
    await donoSemConfirmacao(compartilhada.id, coDona.id, { confirmacaoPedidaEm: vencido });
    await db.empresaMembro.create({ data: { empresaId: compartilhada.id, usuarioId: confirmada.id, confirmadoEm: new Date() } });
    await db.empresa.update({ where: { id: compartilhada.id }, data: { oficial: true } });

    const removidos = await removerDonosVencidos(moderador.id);

    expect(removidos.map((r) => r.usuarioId).sort()).toEqual([venceu.id, coDona.id].sort());
    // Sem nenhum dono, o negócio volta a indicado e sem selo.
    expect(await db.empresa.findUniqueOrThrow({ where: { id: sozinha.id } })).toMatchObject({ status: "indicada", oficial: false });
    // Com outra dona confirmada, o negócio continua como estava.
    expect(await db.empresa.findUniqueOrThrow({ where: { id: compartilhada.id } })).toMatchObject({ status: "verificada", oficial: true });
    expect(await donos(compartilhada.id)).toEqual([confirmada.id]);
    for (const [empresa, pessoa] of [
      [noPrazo, dentroDoPrazo],
      [naoPedido, semPedido],
      [codigo, comCodigo],
      [analise, comAnalise],
    ] as const) {
      expect(await donos(empresa.id)).toEqual([pessoa.id]);
    }
    expect(await db.registroAuditoria.count({ where: { acao: "empresa.dono_removido", usuarioId: moderador.id } })).toBe(2);
  });

  it("a lista mostra primeiro quem mexeu no perfil e diz quem passou do prazo", async () => {
    const [mexeu, quieta] = await Promise.all(["Mexeu", "Quieta"].map((nome) => criarUsuario(nome)));
    const a = await criarEmpresa("quieta");
    const b = await criarEmpresa("mexeu");
    await donoSemConfirmacao(a.id, quieta.id, { confirmacaoPedidaEm: new Date(Date.now() - (PRAZO_CONFIRMACAO_DIAS + 1) * DIA) });
    await donoSemConfirmacao(b.id, mexeu.id);
    await db.registroAuditoria.create({ data: { usuarioId: mexeu.id, acao: "empresa.editada", alvoTipo: "empresa", alvoId: b.id } });

    const lista = await donosSemConfirmacao();

    expect(lista.map((d) => d.usuarioId)).toEqual([mexeu.id, quieta.id]);
    expect(lista[0]).toMatchObject({ edicoes: 1, vencido: false, prazo: null });
    expect(lista[1]).toMatchObject({ edicoes: 0, vencido: true });
  });
});

describe("migração da confirmação dos donos", () => {
  /** O UPDATE da migração que marca quem já tinha confirmado pelo Instagram. */
  function sqlDoPreenchimento(): string {
    const pasta = join("prisma", "migrations");
    const migracao = readdirSync(pasta).find((nome) => nome.endsWith("_confirmacao_dos_donos"));
    if (!migracao) throw new Error("A migração da confirmação dos donos não existe.");
    const sql = readFileSync(join(pasta, migracao, "migration.sql"), "utf8");
    const inicio = sql.indexOf('UPDATE "EmpresaMembro"');
    return sql.slice(inicio, sql.indexOf(";", inicio) + 1);
  }

  it("confirma só quem tem uma reivindicação aprovada pelo Instagram", async () => {
    const [dm, login, documento, moderacao] = await Promise.all(["Dm", "Login", "Documento", "Moderação"].map((nome) => criarUsuario(nome)));
    const empresa = await criarEmpresa("migra.donos");
    const aprovada = (usuarioId: string, metodo: string, revisadoPorId: string | null = null) =>
      db.reivindicacao.create({
        data: { empresaId: empresa.id, usuarioId, metodo, status: "aprovada", revisadoPorId, revisadoEm: new Date(), expiraEm: new Date() },
      });
    for (const [pessoa, metodo] of [
      [dm, "codigo_dm"],
      [login, "instagram_login"],
      [documento, "documento"],
    ] as const) {
      // O botão de aprovar em lote gravava quem estava na moderação: não serve de prova.
      await aprovada(pessoa.id, metodo, metodo === "documento" ? moderacao.id : null);
      await db.empresaMembro.create({ data: { empresaId: empresa.id, usuarioId: pessoa.id } });
    }

    await db.$executeRawUnsafe(sqlDoPreenchimento());

    const confirmados = await db.empresaMembro.findMany({ where: { confirmadoEm: { not: null } } });
    expect(confirmados.map((m) => m.usuarioId).sort()).toEqual([dm.id, login.id].sort());
  });
});
