// Confirmação dos donos. Antes da #133, quem enviava os dados de um negócio sem
// dono virava dono na hora, sem provar nada. Esses donos continuam donos, mas só
// editam depois de confirmar que cuidam do negócio: pelo Instagram (código por DM
// ou login) ou pela aprovação de alguém da moderação.
//
// A moderação pede a confirmação por e-mail. Passado o prazo, sem pedido em
// andamento, ela tira o vínculo, e o negócio fica livre para quem cuida dele.

import { registrarAuditoria } from "@/lib/auditoria";
import { db } from "@/lib/db";

export const PRAZO_CONFIRMACAO_DIAS = 7;
/** No máximo este tanto de e-mails por clique em "Pedir a todos": o plano grátis do Resend manda 100 por dia. */
export const LOTE_DE_PEDIDOS = 50;
const DIA = 24 * 60 * 60 * 1000;

/** As ações do dono que a auditoria registra: mostram quem já mexeu no perfil sem ter confirmado. */
const EDICOES = ["empresa.editada", "empresa.foto_trocada", "empresa.foto_removida", "empresa.ocultada", "empresa.reexibida"];

/** O dono pode editar o negócio: confirmou pelo Instagram ou foi aprovado pela moderação. */
export function donoConfirmado(membro: { confirmadoEm: Date | null } | null | undefined): boolean {
  return !!membro?.confirmadoEm;
}

export function prazoDaConfirmacao(pedidaEm: Date): Date {
  return new Date(pedidaEm.getTime() + PRAZO_CONFIRMACAO_DIAS * DIA);
}

type Par = { empresaId: string; usuarioId: string };

/** Pares (negócio, pessoa) com um pedido de confirmação em andamento: código por DM ou análise manual. */
async function comPedidoEmAndamento(pares: Par[]): Promise<Set<string>> {
  if (pares.length === 0) return new Set();
  const pedidos = await db.reivindicacao.findMany({
    where: {
      status: "pendente",
      metodo: { in: ["codigo_dm", "documento"] },
      OR: pares.map(({ empresaId, usuarioId }) => ({ empresaId, usuarioId })),
    },
    select: { empresaId: true, usuarioId: true },
  });
  return new Set(pedidos.map(chave));
}

function chave({ empresaId, usuarioId }: Par): string {
  return `${empresaId}:${usuarioId}`;
}

/**
 * Os donos sem confirmação, com o que a moderação precisa para decidir: quem já
 * mexeu no perfil vem primeiro, depois quem ainda não recebeu o pedido.
 */
export async function donosSemConfirmacao(agora = new Date()) {
  const membros = await db.empresaMembro.findMany({
    where: { confirmadoEm: null },
    orderBy: { criadoEm: "asc" },
    include: {
      empresa: { select: { id: true, nome: true, instagramUsername: true, moderacao: true } },
      usuario: { select: { id: true, nome: true, email: true } },
    },
  });
  if (membros.length === 0) return [];

  const [emAndamento, edicoes] = await Promise.all([
    comPedidoEmAndamento(membros),
    db.registroAuditoria.groupBy({
      by: ["alvoId", "usuarioId"],
      where: {
        alvoTipo: "empresa",
        acao: { in: EDICOES },
        OR: membros.map((m) => ({ alvoId: m.empresaId, usuarioId: m.usuarioId })),
      },
      _count: true,
    }),
  ]);
  const edicoesPorPar = new Map(edicoes.map((e) => [`${e.alvoId}:${e.usuarioId}`, e._count]));

  return membros
    .map((m) => {
      const prazo = m.confirmacaoPedidaEm ? prazoDaConfirmacao(m.confirmacaoPedidaEm) : null;
      const pedidoEmAndamento = emAndamento.has(chave(m));
      return {
        ...m,
        prazo,
        pedidoEmAndamento,
        vencido: !!prazo && prazo <= agora && !pedidoEmAndamento,
        edicoes: edicoesPorPar.get(chave(m)) ?? 0,
      };
    })
    .sort((a, b) => b.edicoes - a.edicoes || Number(!!a.confirmacaoPedidaEm) - Number(!!b.confirmacaoPedidaEm));
}

/** Marca que a moderação pediu a confirmação. Devolve se marcou (só a primeira vez conta). */
export async function marcarPedidoDeConfirmacao(par: Par & { moderadorId: string }): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const { count } = await tx.empresaMembro.updateMany({
      where: { empresaId: par.empresaId, usuarioId: par.usuarioId, confirmadoEm: null, confirmacaoPedidaEm: null },
      data: { confirmacaoPedidaEm: new Date() },
    });
    if (count === 0) return false;
    await registrarAuditoria(tx, {
      usuarioId: par.moderadorId,
      acao: "empresa.confirmacao_pedida",
      alvoTipo: "empresa",
      alvoId: par.empresaId,
      detalhes: `Pedido de confirmação ao usuário ${par.usuarioId}.`,
    });
    return true;
  });
}

/** "Pedir a todos": marca até `LOTE_DE_PEDIDOS` donos que ainda não receberam o pedido e devolve quem marcou. */
export async function pedirConfirmacaoATodos(moderadorId: string): Promise<Par[]> {
  const faltam = await db.empresaMembro.findMany({
    where: { confirmadoEm: null, confirmacaoPedidaEm: null },
    orderBy: { criadoEm: "asc" },
    take: LOTE_DE_PEDIDOS,
    select: { empresaId: true, usuarioId: true },
  });
  const marcados: Par[] = [];
  for (const par of faltam) {
    if (await marcarPedidoDeConfirmacao({ ...par, moderadorId })) marcados.push(par);
  }
  return marcados;
}

/** A moderação conhece o dono e confirma sem o Instagram. */
export async function confirmarDono(par: Par & { moderadorId: string }): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const { count } = await tx.empresaMembro.updateMany({
      where: { empresaId: par.empresaId, usuarioId: par.usuarioId, confirmadoEm: null },
      data: { confirmadoEm: new Date() },
    });
    if (count === 0) return false;
    await registrarAuditoria(tx, {
      usuarioId: par.moderadorId,
      acao: "empresa.dono_confirmado",
      alvoTipo: "empresa",
      alvoId: par.empresaId,
      detalhes: `Usuário ${par.usuarioId} confirmado pela moderação.`,
    });
    return true;
  });
}

/**
 * Tira o vínculo de quem passou do prazo sem confirmar e sem pedido em andamento.
 * O negócio que fica sem dono volta a "indicada", sem selo. Devolve quem saiu.
 */
export async function removerDonosVencidos(moderadorId: string, agora = new Date()): Promise<Par[]> {
  const vencidos = (await donosSemConfirmacao(agora)).filter((d) => d.vencido);
  const removidos: Par[] = [];
  for (const { empresaId, usuarioId } of vencidos) {
    const saiu = await db.$transaction(async (tx) => {
      // De novo dentro da transação: a pessoa pode ter pedido o código agora há pouco.
      const pedido = await tx.reivindicacao.count({
        where: { empresaId, usuarioId, status: "pendente", metodo: { in: ["codigo_dm", "documento"] } },
      });
      if (pedido > 0) return false;
      const { count } = await tx.empresaMembro.deleteMany({ where: { empresaId, usuarioId, confirmadoEm: null } });
      if (count === 0) return false;
      if ((await tx.empresaMembro.count({ where: { empresaId } })) === 0) {
        await tx.empresa.update({ where: { id: empresaId }, data: { status: "indicada", oficial: false } });
      }
      await registrarAuditoria(tx, {
        usuarioId: moderadorId,
        acao: "empresa.dono_removido",
        alvoTipo: "empresa",
        alvoId: empresaId,
        detalhes: `Usuário ${usuarioId}: o prazo de confirmação acabou.`,
      });
      return true;
    });
    if (saiu) removidos.push({ empresaId, usuarioId });
  }
  return removidos;
}
