import "server-only";
import { registrarAuditoria } from "@/lib/auditoria";
import { db } from "@/lib/db";
import { normalizarUsername } from "@/lib/instagram";
import { textoDeBusca } from "@/lib/texto";

// Troca do @ do negócio (#299). O @ é a identidade do negócio e o endereço da página
// (/empresas/<@>). O dono pede no painel e a troca só vale quando a moderação aprova,
// porque o dono pode ter assumido o perfil só com os dados do negócio, sem provar que
// controla o Instagram. Aprovada, o endereço antigo deixa de existir (404) e fica livre.

export type MotivoRecusaTroca =
  | "arroba_invalido"
  | "mesmo_arroba"
  | "arroba_em_uso"
  | "nao_e_dono"
  | "pedido_em_analise"
  | "ja_decidido"
  | "arroba_mudou";

export class ErroTroca extends Error {
  constructor(public motivo: MotivoRecusaTroca) {
    super(motivo);
  }
}

/** O @ já é de outro negócio? */
async function emUso(arroba: string, empresaId: string): Promise<boolean> {
  const dono = await db.empresa.findUnique({ where: { instagramUsername: arroba }, select: { id: true } });
  return Boolean(dono && dono.id !== empresaId);
}

/** O dono pede a troca do @. Devolve o @ pedido, já normalizado. */
export async function pedirTrocaDeArroba({
  empresaId,
  usuarioId,
  arroba,
}: {
  empresaId: string;
  usuarioId: string;
  arroba: string;
}): Promise<string> {
  const novo = normalizarUsername(arroba);
  if (!novo) throw new ErroTroca("arroba_invalido");
  const membro = await db.empresaMembro.findUnique({
    where: { empresaId_usuarioId: { empresaId, usuarioId } },
    include: { empresa: { select: { instagramUsername: true } } },
  });
  if (!membro) throw new ErroTroca("nao_e_dono");
  const atual = membro.empresa.instagramUsername;
  if (novo === atual) throw new ErroTroca("mesmo_arroba");
  if (await emUso(novo, empresaId)) throw new ErroTroca("arroba_em_uso");

  await db.$transaction(async (tx) => {
    // Trava o negócio: dois pedidos ao mesmo tempo esperam a vez, e só um entra.
    await tx.$queryRaw`SELECT id FROM "Empresa" WHERE id = ${empresaId} FOR NO KEY UPDATE`;
    const pendente = await tx.trocaDeArroba.count({ where: { empresaId, status: "pendente" } });
    if (pendente > 0) throw new ErroTroca("pedido_em_analise");
    await tx.trocaDeArroba.create({ data: { empresaId, usuarioId, arrobaAntigo: atual, arrobaNovo: novo } });
    await registrarAuditoria(tx, {
      usuarioId,
      acao: "empresa.arroba_pedido",
      alvoTipo: "empresa",
      alvoId: empresaId,
      detalhes: `@${atual} → @${novo}`,
    });
  });
  return novo;
}

/** O dono desiste do pedido em análise. Devolve se havia um para cancelar. */
export async function cancelarTrocaDeArroba({ empresaId, usuarioId }: { empresaId: string; usuarioId: string }): Promise<boolean> {
  const membro = await db.empresaMembro.findUnique({ where: { empresaId_usuarioId: { empresaId, usuarioId } } });
  if (!membro) throw new ErroTroca("nao_e_dono");
  const { count } = await db.trocaDeArroba.updateMany({
    where: { empresaId, status: "pendente" },
    data: { status: "cancelada", decididoEm: new Date() },
  });
  return count > 0;
}

type Decisao = { empresaId: string; usuarioId: string; arrobaNovo: string; endereco: string };

/**
 * A moderação aprova: o negócio passa a usar o @ novo, que vira o endereço da página.
 * Os IDs do Instagram ligados ao @ antigo saem, porque eram de outra conta. Recusa se o
 * pedido já foi decidido, se o @ do negócio mudou depois do pedido ou se o @ novo foi
 * ocupado por outro negócio enquanto isso.
 */
export async function aprovarTrocaDeArroba({ trocaId, moderadorId }: { trocaId: string; moderadorId: string }): Promise<Decisao> {
  return db.$transaction(async (tx) => {
    const troca = await tx.trocaDeArroba.findUnique({ where: { id: trocaId } });
    if (!troca) throw new ErroTroca("ja_decidido");
    await tx.$queryRaw`SELECT id FROM "Empresa" WHERE id = ${troca.empresaId} FOR NO KEY UPDATE`;
    const [pedido, empresa] = await Promise.all([
      tx.trocaDeArroba.findUniqueOrThrow({ where: { id: trocaId } }),
      tx.empresa.findUniqueOrThrow({ where: { id: troca.empresaId } }),
    ]);
    if (pedido.status !== "pendente") throw new ErroTroca("ja_decidido");
    if (empresa.instagramUsername !== pedido.arrobaAntigo) throw new ErroTroca("arroba_mudou");
    const ocupado = await tx.empresa.findUnique({ where: { instagramUsername: pedido.arrobaNovo }, select: { id: true } });
    if (ocupado) throw new ErroTroca("arroba_em_uso");

    await tx.empresa.update({
      where: { id: empresa.id },
      data: {
        instagramUsername: pedido.arrobaNovo,
        instagramUserId: null,
        instagramIgsid: null,
        busca: textoDeBusca({ ...empresa, instagramUsername: pedido.arrobaNovo }),
      },
    });
    await tx.trocaDeArroba.update({
      where: { id: trocaId },
      data: { status: "aprovada", decididoPorId: moderadorId, decididoEm: new Date() },
    });
    await registrarAuditoria(tx, {
      usuarioId: moderadorId,
      acao: "empresa.arroba_trocado",
      alvoTipo: "empresa",
      alvoId: empresa.id,
      detalhes: `@${pedido.arrobaAntigo} → @${pedido.arrobaNovo}`,
    });
    return { empresaId: empresa.id, usuarioId: pedido.usuarioId, arrobaNovo: pedido.arrobaNovo, endereco: pedido.arrobaNovo };
  });
}

/** A moderação recusa, com o motivo, que o dono vê no painel e no e-mail. */
export async function recusarTrocaDeArroba({
  trocaId,
  moderadorId,
  motivo,
}: {
  trocaId: string;
  moderadorId: string;
  motivo: string;
}): Promise<Decisao> {
  return db.$transaction(async (tx) => {
    const { count } = await tx.trocaDeArroba.updateMany({
      where: { id: trocaId, status: "pendente" },
      data: { status: "recusada", motivo, decididoPorId: moderadorId, decididoEm: new Date() },
    });
    if (count === 0) throw new ErroTroca("ja_decidido");
    const troca = await tx.trocaDeArroba.findUniqueOrThrow({ where: { id: trocaId }, include: { empresa: { select: { instagramUsername: true } } } });
    await registrarAuditoria(tx, {
      usuarioId: moderadorId,
      acao: "empresa.arroba_recusado",
      alvoTipo: "empresa",
      alvoId: troca.empresaId,
      detalhes: `@${troca.arrobaAntigo} → @${troca.arrobaNovo} · ${motivo}`,
    });
    return { empresaId: troca.empresaId, usuarioId: troca.usuarioId, arrobaNovo: troca.arrobaNovo, endereco: troca.empresa.instagramUsername };
  });
}

/** O último pedido do negócio, para o painel do dono mostrar o que está em análise ou a última recusa. */
export function ultimaTrocaDeArroba(empresaId: string) {
  return db.trocaDeArroba.findFirst({
    where: { empresaId },
    orderBy: { criadoEm: "desc" },
    select: { status: true, arrobaNovo: true, motivo: true, criadoEm: true },
  });
}
