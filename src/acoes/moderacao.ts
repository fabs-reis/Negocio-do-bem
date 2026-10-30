"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { registrarAuditoria } from "@/lib/auditoria";
import { exigirModerador } from "@/lib/auth/sessao";
import { db } from "@/lib/db";
import { confirmarDono, marcarPedidoDeConfirmacao, pedirConfirmacaoATodos, removerDonosVencidos } from "@/lib/donos";
import { texto } from "@/lib/formulario";
import { comAviso, destinoNaModeracao } from "@/lib/moderacao/filtros";
import { avisarDecisaoDaReivindicacao, avisarDonoRemovido, avisarPedidoDeConfirmacao } from "@/lib/notificacoes";
import { aprovar, ErroReivindicacao, recusar, registrarEnvio, type ModoAprovacao } from "@/lib/reivindicacao";

function voltar(aba: string, aviso: string): never {
  redirect(`/moderacao?aba=${aba}&aviso=${aviso}`);
}

/** A moderação mandou a DM com o código: o prazo de 48 horas começa a contar. */
export async function registrarEnvioDoCodigo(dados: FormData): Promise<void> {
  const moderador = await exigirModerador();
  try {
    await registrarEnvio({ reivindicacaoId: texto(dados, "reivindicacaoId"), revisorId: moderador.id });
  } catch (erro) {
    if (erro instanceof ErroReivindicacao) voltar("reivindicacoes", "ja_processada");
    throw erro;
  }
  voltar("reivindicacoes", "codigo_enviado");
}

function donoDoFormulario(dados: FormData) {
  return { empresaId: texto(dados, "empresaId"), usuarioId: texto(dados, "usuarioId") };
}

/** Pede, por e-mail, que um dono sem confirmação confirme. O prazo começa a contar. */
export async function pedirConfirmacaoDoDono(dados: FormData): Promise<void> {
  const moderador = await exigirModerador();
  const par = donoDoFormulario(dados);
  if (await marcarPedidoDeConfirmacao({ ...par, moderadorId: moderador.id })) after(() => avisarPedidoDeConfirmacao(par));
  voltar("donos", "confirmacao_pedida");
}

/** Pede a confirmação a um lote de donos que ainda não receberam o pedido. */
export async function pedirConfirmacaoATodosOsDonos(): Promise<void> {
  const moderador = await exigirModerador();
  const marcados = await pedirConfirmacaoATodos(moderador.id);
  after(async () => {
    for (const par of marcados) await avisarPedidoDeConfirmacao(par);
  });
  voltar("donos", "confirmacao_pedida");
}

/** A moderação conhece o dono e confirma sem o Instagram. */
export async function confirmarDonoPelaModeracao(dados: FormData): Promise<void> {
  const moderador = await exigirModerador();
  await confirmarDono({ ...donoDoFormulario(dados), moderadorId: moderador.id });
  voltar("donos", "dono_confirmado");
}

/** Tira o vínculo de quem passou do prazo sem confirmar e sem pedido em andamento. */
export async function removerDonosQueNaoConfirmaram(): Promise<void> {
  const moderador = await exigirModerador();
  const removidos = await removerDonosVencidos(moderador.id);
  after(async () => {
    for (const par of removidos) await avisarDonoRemovido({ ...par, motivo: "prazo" });
  });
  voltar("donos", "donos_removidos");
}

/** Esvazia a fila antiga: publica todas as indicações que esperavam a moderação. */
export async function publicarIndicacoesPendentes(): Promise<void> {
  const moderador = await exigirModerador();
  const pendentes = await db.empresa.findMany({ where: { moderacao: "pendente" }, select: { id: true, instagramUsername: true } });
  for (const { id, instagramUsername } of pendentes) {
    await db.$transaction(async (tx) => {
      const { count } = await tx.empresa.updateMany({ where: { id, moderacao: "pendente" }, data: { moderacao: "aprovada" } });
      if (count === 0) return;
      await registrarAuditoria(tx, {
        usuarioId: moderador.id,
        acao: "empresa.aprovada",
        alvoTipo: "empresa",
        alvoId: id,
        detalhes: `@${instagramUsername}`,
      });
    });
  }
  voltar("indicacoes", "feito");
}

export async function aprovarReivindicacao(dados: FormData): Promise<void> {
  const moderador = await exigirModerador();
  const modo: ModoAprovacao = dados.get("modo") === "transferir" ? "transferir" : "adicionar";
  const reivindicacaoId = texto(dados, "reivindicacaoId");
  try {
    await aprovar({ reivindicacaoId, revisorId: moderador.id, modo });
  } catch (erro) {
    if (erro instanceof ErroReivindicacao) voltar("reivindicacoes", "ja_processada");
    throw erro;
  }
  after(() => avisarDecisaoDaReivindicacao(reivindicacaoId));
  voltar("reivindicacoes", "feito");
}

export async function recusarReivindicacao(dados: FormData): Promise<void> {
  const moderador = await exigirModerador();
  const motivo = texto(dados, "motivo").trim().slice(0, 500) || "Não foi possível confirmar que você controla este negócio.";
  const reivindicacaoId = texto(dados, "reivindicacaoId");
  try {
    await recusar({ reivindicacaoId, revisorId: moderador.id, motivo });
  } catch (erro) {
    if (erro instanceof ErroReivindicacao) voltar("reivindicacoes", "ja_processada");
    throw erro;
  }
  after(() => avisarDecisaoDaReivindicacao(reivindicacaoId));
  voltar("reivindicacoes", "feito");
}

/**
 * Publica ou tira do ar um negócio. Serve para a fila de indicações e para a aba
 * Negócios, que manda em `voltar` a lista filtrada de onde o pedido saiu.
 */
export async function moderarEmpresa(dados: FormData): Promise<void> {
  const moderador = await exigirModerador();
  const decisao = dados.get("decisao") === "aprovar" ? "aprovada" : "rejeitada";
  const aba = dados.get("aba") === "negocios" ? "negocios" : "indicacoes";
  const empresa = await db.empresa.update({
    where: { id: texto(dados, "empresaId") },
    data: { moderacao: decisao },
  });
  await registrarAuditoria(db, {
    usuarioId: moderador.id,
    acao: decisao === "aprovada" ? "empresa.aprovada" : "empresa.rejeitada",
    alvoTipo: "empresa",
    alvoId: empresa.id,
    detalhes: `@${empresa.instagramUsername}`,
  });
  const destino = destinoNaModeracao(dados.get("voltar"));
  if (destino) redirect(comAviso(destino, "feito"));
  voltar(aba, "feito");
}

export async function decidirDenuncia(dados: FormData): Promise<void> {
  const moderador = await exigirModerador();
  const remover = dados.get("decisao") === "remover";
  const depoimento = await db.depoimento.update({
    where: { id: texto(dados, "depoimentoId") },
    data: remover ? { status: "removido", denunciado: false } : { denunciado: false, motivoDenuncia: null, denunciadoPorId: null },
  });
  await registrarAuditoria(db, {
    usuarioId: moderador.id,
    acao: remover ? "depoimento.removido" : "depoimento.mantido",
    alvoTipo: "depoimento",
    alvoId: depoimento.id,
  });
  voltar("denuncias", "feito");
}
