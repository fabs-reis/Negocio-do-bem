// Regras para o dono reivindicar o perfil do seu negócio.
//
// Há três caminhos (ver README):
//   - "codigo_dm": o caminho principal. A pessoa pede um código, segue o perfil
//     oficial (o @ do projeto, ou o INSTAGRAM_PERFIL_OFICIAL) pelo Instagram do
//     negócio e manda um "Oi". A moderação responde com o código nessa conversa, e
//     a pessoa cola o código no site. O código só aparece para a moderação: acertar
//     prova que a pessoa lê as mensagens do Instagram do negócio. O webhook ainda
//     aceita o código mandado de volta por DM, a partir do @ do negócio.
//   - "instagram_login": login na conta profissional; aprovação instantânea.
//     Desligado enquanto as variáveis do app da Meta estiverem vazias.
//   - "documento": a análise manual, para quem não tem acesso ao Instagram do
//     negócio ou não recebeu o código. Sempre fica com a moderação.
//
// A aprovação automática só acontece pelo Instagram e sem nenhum conflito. Qualquer
// situação estranha (negócio que já tem dono, negócio tirado do ar, @ que mudou de
// conta, mesma conta ligada a outro perfil) vira uma solicitação pendente com
// anotações para a moderação decidir.
//
// Os dois caminhos pelo Instagram dão o selo "Perfil oficial" (Empresa.oficial).
// Quem assumiu pelos dados do negócio também pode usá-los depois, para ganhar o selo.

import { registrarAuditoria } from "@/lib/auditoria";
import { gerarCodigo, extrairCodigo } from "@/lib/codigo";
import { db, type Prisma } from "@/lib/db";
import { avisarDonoRemovido } from "@/lib/notificacoes";
import { formatarDataHora } from "@/lib/texto";

/** O código vale por este tempo depois que a moderação manda a DM. */
export const VALIDADE_CODIGO_HORAS = 48;
/** A pessoa pode pedir o código de novo até a moderação ter mandado este tanto de vezes. */
export const LIMITE_ENVIOS = 2;
/** Tentativas de digitar cada código. Depois, só com outro envio. */
export const LIMITE_TENTATIVAS = 5;
const VALIDADE_ANALISE_DIAS = 30;
const LIMITE_SOLICITACOES_POR_DIA = 10;

/** Erro com mensagem que pode ser mostrada para a pessoa. */
export class ErroReivindicacao extends Error {}

function daquiA(ms: number): Date {
  return new Date(Date.now() + ms);
}
const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

function violouUnicidade(erro: unknown): boolean {
  return typeof erro === "object" && erro !== null && "code" in erro && erro.code === "P2002";
}

/** O dono que nunca confirmou (src/lib/donos.ts) ainda pode pedir a análise manual. */
async function exigirQueNaoSejaDonoConfirmado(empresaId: string, usuarioId: string) {
  const membro = await db.empresaMembro.findUnique({
    where: { empresaId_usuarioId: { empresaId, usuarioId } },
  });
  if (membro?.confirmadoEm) throw new ErroReivindicacao("Você já é dono deste negócio.");
}

/**
 * Quem já é dono confirma pelo Instagram enquanto falta alguma coisa: a própria
 * confirmação (para editar) ou o selo do perfil.
 */
async function exigirQueFalteConfirmar(empresaId: string, usuarioId: string) {
  const membro = await db.empresaMembro.findUnique({
    where: { empresaId_usuarioId: { empresaId, usuarioId } },
    select: { confirmadoEm: true, empresa: { select: { oficial: true } } },
  });
  if (membro?.confirmadoEm && membro.empresa.oficial) throw new ErroReivindicacao("Você já é dono deste negócio.");
}

/**
 * Trava a linha da pessoa até o fim da transação. Todo caminho que cria um
 * pedido chama isto primeiro, antes de contar: pedidos simultâneos da mesma
 * conta entram um de cada vez e cada um enxerga os anteriores já gravados. Sem
 * a trava, todos leriam a mesma contagem e passariam do limite.
 *
 * A trava é FOR NO KEY UPDATE (e não FOR UPDATE) de propósito: o banco pede
 * FOR KEY SHARE na linha da pessoa a cada linha que aponta para ela, como o
 * `aprovar` faz ao criar o dono. Essa trava não conflita com a nossa, então
 * a aprovação não espera pela trava da cota enquanto segura a empresa.
 */
async function bloquearPessoa(tx: Prisma.TransactionClient, usuarioId: string) {
  await tx.$queryRaw`SELECT id FROM "Usuario" WHERE id = ${usuarioId} FOR NO KEY UPDATE`;
}

// Antecipa a trava da chave estrangeira: empresa antes de pedidos, como em aprovar.
async function bloquearEmpresa(tx: Prisma.TransactionClient, empresaId: string) {
  await tx.$queryRaw`SELECT id FROM "Empresa" WHERE id = ${empresaId} FOR KEY SHARE`;
}

/** Só vale depois de `bloquearPessoa`, na mesma transação que cria o pedido. */
async function exigirLimiteDiario(tx: Prisma.TransactionClient, usuarioId: string) {
  const recentes = await tx.reivindicacao.count({
    where: { usuarioId, criadoEm: { gte: new Date(Date.now() - DIA) } },
  });
  if (recentes >= LIMITE_SOLICITACOES_POR_DIA) {
    throw new ErroReivindicacao("Você fez muitas solicitações nas últimas 24 horas. Tente de novo amanhã.");
  }
}

// ---------------------------------------------------------------------------
// Caminho 2: código por DM
// ---------------------------------------------------------------------------

/**
 * Gera (ou reaproveita, se ainda valer) o código que a moderação vai mandar por DM.
 * Até o envio, o pedido espera o prazo de uma análise; o envio dá ao código as
 * horas de `VALIDADE_CODIGO_HORAS`.
 */
export async function iniciarPorCodigoDm(empresaId: string, usuarioId: string) {
  await exigirQueFalteConfirmar(empresaId, usuarioId);

  for (let tentativa = 0; tentativa < 5; tentativa++) {
    try {
      // Cota, expiração e criação na mesma transação. Se o código repetir, a
      // transação inteira volta e a próxima tentativa recomeça do zero.
      return await db.$transaction(async (tx) => {
        await bloquearPessoa(tx, usuarioId);
        const vigente = await tx.reivindicacao.findFirst({
          where: { empresaId, usuarioId, metodo: "codigo_dm", status: "pendente", expiraEm: { gt: new Date() } },
        });
        if (vigente) return vigente;

        await exigirLimiteDiario(tx, usuarioId);
        await bloquearEmpresa(tx, empresaId);
        await tx.reivindicacao.updateMany({
          where: { empresaId, usuarioId, metodo: "codigo_dm", status: "pendente", expiraEm: { lte: new Date() } },
          data: { status: "expirada" },
        });
        return await tx.reivindicacao.create({
          data: {
            empresaId,
            usuarioId,
            metodo: "codigo_dm",
            codigo: gerarCodigo(),
            expiraEm: daquiA(VALIDADE_ANALISE_DIAS * DIA),
          },
        });
      });
    } catch (erro) {
      if (!violouUnicidade(erro)) throw erro;
    }
  }
  throw new Error("Não foi possível gerar um código único.");
}

/** O pedido de código por DM em andamento desta pessoa para este negócio. */
export function pedidoDeCodigo(empresaId: string, usuarioId: string) {
  return db.reivindicacao.findFirst({
    where: { empresaId, usuarioId, metodo: "codigo_dm", status: "pendente" },
    orderBy: { criadoEm: "desc" },
  });
}

/** A moderação mandou a DM com o código: a partir de agora ele vale `VALIDADE_CODIGO_HORAS`. */
export async function registrarEnvio(params: { reivindicacaoId: string; revisorId: string }): Promise<void> {
  await db.$transaction(async (tx) => {
    const pedido = await tx.reivindicacao.findUnique({ where: { id: params.reivindicacaoId } });
    const { count } = await tx.reivindicacao.updateMany({
      where: { id: params.reivindicacaoId, metodo: "codigo_dm", status: "pendente" },
      data: {
        envios: { increment: 1 },
        enviadoEm: new Date(),
        expiraEm: daquiA(VALIDADE_CODIGO_HORAS * HORA),
        reenvioPedidoEm: null,
      },
    });
    if (!pedido || count === 0) throw new ErroReivindicacao("Esta solicitação não está mais pendente.");
    await registrarAuditoria(tx, {
      usuarioId: params.revisorId,
      acao: "reivindicacao.codigo_enviado",
      alvoTipo: "empresa",
      alvoId: pedido.empresaId,
      detalhes: `Reivindicação ${pedido.id}: envio ${pedido.envios + 1}.`,
    });
  });
}

/**
 * A DM não chegou: a pessoa pede outro envio. O código muda, para um código que
 * pode ter ido parar em outro lugar não valer mais, e as tentativas recomeçam.
 */
export async function pedirOutroEnvio(empresaId: string, usuarioId: string): Promise<void> {
  const pedido = await pedidoDeCodigo(empresaId, usuarioId);
  if (!pedido) throw new ErroReivindicacao("Não encontramos um pedido de código. Peça o código de novo.");
  if (pedido.envios === 0) throw new ErroReivindicacao("A gente ainda não mandou o primeiro código. Siga os passos e aguarde a DM.");
  if (pedido.envios >= LIMITE_ENVIOS) {
    throw new ErroReivindicacao("Já mandamos o código duas vezes. Peça uma análise manual logo abaixo.");
  }
  if (pedido.reenvioPedidoEm) throw new ErroReivindicacao("Você já pediu outro envio. Aguarde a DM.");

  for (let tentativa = 0; tentativa < 5; tentativa++) {
    try {
      // As condições de novo na escrita: dois pedidos ao mesmo tempo viram um só.
      const { count } = await db.reivindicacao.updateMany({
        where: { id: pedido.id, status: "pendente", reenvioPedidoEm: null, envios: { gte: 1, lt: LIMITE_ENVIOS } },
        data: {
          codigo: gerarCodigo(),
          tentativas: 0,
          reenvioPedidoEm: new Date(),
          expiraEm: daquiA(VALIDADE_ANALISE_DIAS * DIA),
        },
      });
      if (count === 0) throw new ErroReivindicacao("Você já pediu outro envio. Aguarde a DM.");
      return;
    } catch (erro) {
      if (!violouUnicidade(erro)) throw erro;
    }
  }
  throw new Error("Não foi possível gerar um código único.");
}

export type ResultadoConfirmacao = "aprovada" | "em_analise";

/**
 * Confere o código que a pessoa colou no site. Sem conflito, ela vira dona com o
 * selo de perfil oficial; com conflito, o pedido fica com a moderação, já com o
 * código confirmado.
 */
export async function confirmarCodigo(params: {
  empresaId: string;
  usuarioId: string;
  texto: string;
}): Promise<ResultadoConfirmacao> {
  const codigo = extrairCodigo(params.texto);
  if (!codigo) throw new ErroReivindicacao("Digite o código que chegou na DM, no formato BEM-7K3F9Q.");
  const pedido = await pedidoDeCodigo(params.empresaId, params.usuarioId);
  if (!pedido?.codigo) throw new ErroReivindicacao("Não encontramos um pedido de código. Peça o código de novo.");
  if (pedido.codigoConfirmadoEm) return "em_analise";

  // A tentativa conta antes da comparação, com a linha travada: tentativas ao mesmo
  // tempo não passam do limite, e um código trocado no meio do caminho não vale.
  const conferencia = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Reivindicacao" WHERE id = ${pedido.id} FOR UPDATE`;
    const atual = await tx.reivindicacao.findUniqueOrThrow({ where: { id: pedido.id } });
    if (atual.status !== "pendente") return { tipo: "decidido" as const, aprovada: atual.status === "aprovada" };
    if (atual.expiraEm <= new Date()) return { tipo: "vencido" as const };
    if (atual.tentativas >= LIMITE_TENTATIVAS) return { tipo: "bloqueado" as const };
    await tx.reivindicacao.update({ where: { id: atual.id }, data: { tentativas: { increment: 1 } } });
    if (atual.codigo !== codigo) return { tipo: "errado" as const, restam: LIMITE_TENTATIVAS - atual.tentativas - 1 };
    await tx.reivindicacao.update({ where: { id: atual.id }, data: { codigoConfirmadoEm: new Date() } });
    return { tipo: "certo" as const };
  });

  switch (conferencia.tipo) {
    case "decidido":
      // Dois envios do mesmo código ao mesmo tempo: o outro já aprovou.
      if (conferencia.aprovada) return "aprovada";
      throw new ErroReivindicacao("Esta solicitação não está mais pendente.");
    case "vencido":
      throw new ErroReivindicacao("Este código venceu. Peça outro envio.");
    case "bloqueado":
      throw new ErroReivindicacao("O código foi digitado errado muitas vezes. Peça outro envio.");
    case "errado":
      throw new ErroReivindicacao(
        conferencia.restam > 0
          ? `Esse código não confere. ${conferencia.restam === 1 ? "Resta 1 tentativa" : `Restam ${conferencia.restam} tentativas`}.`
          : "Esse código não confere, e as tentativas acabaram. Peça outro envio.",
      );
  }

  const empresa = await db.empresa.findUniqueOrThrow({ where: { id: params.empresaId }, include: { membros: true } });
  const conflitos = await conflitosDeVerificacao({ empresa, usuarioId: params.usuarioId });
  if (conflitos.length > 0) {
    await anotar(pedido.id, `Código confirmado no site. ${conflitos.join(" ")}`);
    return "em_analise";
  }
  try {
    await aprovar({ reivindicacaoId: pedido.id, revisorId: null });
  } catch (erro) {
    // Dois envios do mesmo código ao mesmo tempo: o outro já aprovou, e esta
    // aprovação voltou (pelo pedido já decidido ou pelo dono já criado).
    const depois = await db.reivindicacao.findUnique({ where: { id: pedido.id }, select: { status: true } });
    if (depois?.status !== "aprovada") throw erro;
  }
  return "aprovada";
}

/**
 * Processa uma DM recebida pelo perfil oficial (webhook).
 * `buscarUsername` descobre o @ de quem enviou a partir do IGSID.
 */
export async function processarDm(params: {
  remetenteId: string;
  texto: string;
  buscarUsername: (igsid: string) => Promise<string | null>;
}): Promise<"aprovada" | "em_analise" | "ignorada"> {
  const codigo = extrairCodigo(params.texto);
  if (!codigo) return "ignorada";

  const reivindicacao = await db.reivindicacao.findUnique({
    where: { codigo },
    include: { empresa: { include: { membros: true } } },
  });
  if (!reivindicacao || reivindicacao.metodo !== "codigo_dm" || reivindicacao.status !== "pendente") {
    return "ignorada";
  }
  const { empresa } = reivindicacao;

  if (reivindicacao.expiraEm <= new Date()) {
    await anotar(reivindicacao.id, "Código recebido por DM depois de expirar.");
    return "em_analise";
  }

  const username = await params.buscarUsername(params.remetenteId);
  if (!username) {
    await anotar(
      reivindicacao.id,
      "Código recebido por DM, mas não deu para confirmar o @ automaticamente. Confira no Instagram.",
    );
    return "em_analise";
  }
  if (username !== empresa.instagramUsername) {
    await anotar(reivindicacao.id, `Código recebido por DM de @${username}, que não é o @ deste negócio.`);
    return "em_analise";
  }

  const conflitos = await conflitosDeVerificacao({
    empresa,
    usuarioId: reivindicacao.usuarioId,
    instagramIgsid: params.remetenteId,
  });
  if (conflitos.length > 0) {
    await db.reivindicacao.update({
      where: { id: reivindicacao.id },
      data: { instagramIgsid: params.remetenteId },
    });
    await anotar(reivindicacao.id, `Código recebido por DM de @${username}. ${conflitos.join(" ")}`);
    return "em_analise";
  }

  await aprovar({ reivindicacaoId: reivindicacao.id, revisorId: null, instagramIgsid: params.remetenteId });
  return "aprovada";
}

// ---------------------------------------------------------------------------
// Caminho 1: Entrar com Instagram
// ---------------------------------------------------------------------------

export type ResultadoLoginInstagram =
  | { tipo: "verificada" }
  | { tipo: "em_analise" }
  | { tipo: "conta_diferente"; conectada: string };

/** Recebe a conta que o Instagram confirmou no login e decide o que fazer. */
export async function processarLoginInstagram(params: {
  empresaId: string;
  usuarioId: string;
  conta: { userId: string; username: string };
}): Promise<ResultadoLoginInstagram> {
  const { empresaId, usuarioId, conta } = params;
  const empresa = await db.empresa.findUnique({ where: { id: empresaId }, include: { membros: true } });
  if (!empresa) throw new ErroReivindicacao("Negócio não encontrado.");

  if (conta.username !== empresa.instagramUsername) {
    return { tipo: "conta_diferente", conectada: conta.username };
  }
  // Quem já é dono e falta confirmar (ou falta o selo) segue: o login confirma e dá o selo.
  if (empresa.oficial && empresa.membros.some((m) => m.usuarioId === usuarioId && m.confirmadoEm)) {
    return { tipo: "verificada" };
  }

  const conflitos = await conflitosDeVerificacao({ empresa, usuarioId, instagramUserId: conta.userId });

  const reivindicacao = await db.$transaction(async (tx) => {
    await bloquearPessoa(tx, usuarioId);
    await exigirLimiteDiario(tx, usuarioId);
    await bloquearEmpresa(tx, empresaId);
    // Tentativas anteriores pelo mesmo caminho ficam obsoletas.
    await tx.reivindicacao.updateMany({
      where: { empresaId, usuarioId, metodo: "instagram_login", status: "pendente" },
      data: { status: "cancelada" },
    });
    return tx.reivindicacao.create({
      data: {
        empresaId,
        usuarioId,
        metodo: "instagram_login",
        instagramUserId: conta.userId,
        notas: conflitos.length > 0 ? linhaDeNota(`Login confirmado como @${conta.username}. ${conflitos.join(" ")}`) : "",
        expiraEm: daquiA(VALIDADE_ANALISE_DIAS * DIA),
      },
    });
  });

  if (conflitos.length > 0) return { tipo: "em_analise" };
  await aprovar({ reivindicacaoId: reivindicacao.id, revisorId: null });
  return { tipo: "verificada" };
}

// ---------------------------------------------------------------------------
// Caminho 3: documento (análise manual)
// ---------------------------------------------------------------------------

/**
 * Recebe os dados do negócio para a análise manual. O pedido fica sempre com a
 * moderação: CNPJ e contato não provam que a pessoa cuida do negócio (o CNPJ é
 * público e o contato é ela quem digita).
 */
export async function solicitarPorDocumento(params: {
  empresaId: string;
  usuarioId: string;
  cnpj: string | null;
  site: string | null;
  relacao: string;
  contato: string;
  mensagem: string | null;
}) {
  await exigirQueNaoSejaDonoConfirmado(params.empresaId, params.usuarioId);

  return db.$transaction(async (tx) => {
    await bloquearPessoa(tx, params.usuarioId);
    const emAnalise = await tx.reivindicacao.findFirst({
      where: { empresaId: params.empresaId, usuarioId: params.usuarioId, metodo: "documento", status: "pendente" },
    });
    if (emAnalise) throw new ErroReivindicacao("Você já enviou os dados deste negócio e eles estão em análise.");
    await exigirLimiteDiario(tx, params.usuarioId);

    return tx.reivindicacao.create({
      data: {
        empresaId: params.empresaId,
        usuarioId: params.usuarioId,
        metodo: "documento",
        cnpj: params.cnpj,
        site: params.site,
        relacao: params.relacao,
        contato: params.contato,
        mensagem: params.mensagem,
        expiraEm: daquiA(VALIDADE_ANALISE_DIAS * DIA),
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Decisões
// ---------------------------------------------------------------------------

/**
 * Situações que impedem a aprovação automática. A lista vazia significa
 * "pode aprovar sozinho".
 */
async function conflitosDeVerificacao(params: {
  empresa: {
    id: string;
    moderacao: string;
    instagramUserId: string | null;
    instagramIgsid: string | null;
    membros: { usuarioId: string; confirmadoEm: Date | null }[];
  };
  usuarioId: string;
  instagramUserId?: string;
  instagramIgsid?: string;
}): Promise<string[]> {
  const { empresa, usuarioId, instagramUserId, instagramIgsid } = params;
  const conflitos: string[] = [];

  // Só a moderação publica de novo um negócio que ela tirou do ar.
  if (empresa.moderacao === "rejeitada") {
    conflitos.push("O negócio está fora do ar: a moderação tirou do ar e decide se publica de novo.");
  }
  // Um dono que nunca confirmou não segura o perfil: quem confirma pelo Instagram passa na frente (ver aprovar).
  if (empresa.membros.some((m) => m.usuarioId !== usuarioId && m.confirmadoEm)) {
    conflitos.push("O negócio já tem dono confirmado: decida entre adicionar como co-dono ou transferir.");
  }
  if (
    (instagramUserId && empresa.instagramUserId && empresa.instagramUserId !== instagramUserId) ||
    (instagramIgsid && empresa.instagramIgsid && empresa.instagramIgsid !== instagramIgsid)
  ) {
    conflitos.push("A conta do Instagram é diferente da registrada antes: o @ pode ter mudado de dono.");
  }
  const outra = await db.empresa.findFirst({
    where: {
      id: { not: empresa.id },
      OR: [
        ...(instagramUserId ? [{ instagramUserId }] : []),
        ...(instagramIgsid ? [{ instagramIgsid }] : []),
      ],
    },
    select: { instagramUsername: true },
  });
  if (outra) {
    conflitos.push(`Esta conta do Instagram já está ligada ao perfil @${outra.instagramUsername} (talvez o @ tenha mudado).`);
  }
  return conflitos;
}

export type ModoAprovacao = "adicionar" | "transferir";

/**
 * Aprova a reivindicação: a pessoa vira dona e o negócio fica verificado.
 * `revisorId` null significa aprovação automática, que não muda a moderação do
 * negócio: só a decisão de alguém da moderação publica o negócio.
 * `transferir` remove os donos anteriores (usado em disputas).
 *
 * A pessoa aprovada fica confirmada (pode editar) quando provou pelo Instagram ou
 * quando alguém da moderação aprovou. Quem confirma pelo Instagram passa na frente
 * dos donos que nunca confirmaram: eles saem, e cada um recebe um e-mail.
 *
 * O selo "Perfil oficial" vale enquanto um dono atual confirmou pelo Instagram:
 * - pelo Instagram (login, ou código por DM confirmado no site ou pelo webhook), o
 *   negócio fica oficial. Um pedido de código aprovado sem o código não conta;
 * - pelos dados do negócio, o selo fica como estava se continua outro dono (co-dono)
 *   e sai se não continua nenhum (transferência, ou negócio que estava sem dono).
 */
export async function aprovar(params: {
  reivindicacaoId: string;
  revisorId: string | null;
  modo?: ModoAprovacao;
  instagramUserId?: string;
  instagramIgsid?: string;
}): Promise<void> {
  const { reivindicacaoId, revisorId, modo = "adicionar" } = params;

  const removidos = await db.$transaction(async (tx) => {
    const reivindicacao = await tx.reivindicacao.findUnique({ where: { id: reivindicacaoId } });
    if (!reivindicacao || reivindicacao.status !== "pendente") {
      throw new ErroReivindicacao("Esta solicitação não está mais pendente.");
    }
    const { empresaId, usuarioId } = reivindicacao;
    const instagramUserId = params.instagramUserId ?? reivindicacao.instagramUserId;
    const instagramIgsid = params.instagramIgsid ?? reivindicacao.instagramIgsid;

    if (modo === "transferir") {
      await tx.empresaMembro.deleteMany({ where: { empresaId, usuarioId: { not: usuarioId } } });
    }
    const peloInstagram =
      reivindicacao.metodo === "instagram_login" ||
      (reivindicacao.metodo === "codigo_dm" && (!!reivindicacao.codigoConfirmadoEm || !!instagramIgsid));
    const semConfirmacao = peloInstagram
      ? await tx.empresaMembro.findMany({
          where: { empresaId, usuarioId: { not: usuarioId }, confirmadoEm: null },
          select: { usuarioId: true },
        })
      : [];
    if (semConfirmacao.length > 0) {
      await tx.empresaMembro.deleteMany({ where: { empresaId, usuarioId: { in: semConfirmacao.map((m) => m.usuarioId) } } });
    }
    const outrosDonos = await tx.empresaMembro.count({ where: { empresaId, usuarioId: { not: usuarioId } } });
    const confirmadoEm = peloInstagram || revisorId ? new Date() : null;
    await tx.empresaMembro.upsert({
      where: { empresaId_usuarioId: { empresaId, usuarioId } },
      create: { empresaId, usuarioId, papel: "dono", confirmadoEm },
      update: confirmadoEm ? { confirmadoEm } : {},
    });

    // A conta do Instagram pertence a quem acabou de provar o controle dela:
    // se estava ligada a outro perfil (troca de @), deixa de estar.
    if (instagramUserId) {
      await tx.empresa.updateMany({
        where: { instagramUserId, id: { not: empresaId } },
        data: { instagramUserId: null },
      });
    }
    if (instagramIgsid) {
      await tx.empresa.updateMany({
        where: { instagramIgsid, id: { not: empresaId } },
        data: { instagramIgsid: null },
      });
    }
    await tx.empresa.update({
      where: { id: empresaId },
      data: {
        status: "verificada",
        ...(revisorId ? { moderacao: "aprovada" } : {}),
        ...(peloInstagram ? { oficial: true } : outrosDonos === 0 ? { oficial: false } : {}),
        ...(instagramUserId ? { instagramUserId } : {}),
        ...(instagramIgsid ? { instagramIgsid } : {}),
      },
    });

    // Escrita condicional, no mesmo lugar da ordem de travas: duas aprovações do mesmo
    // pedido ao mesmo tempo (o mesmo código colado duas vezes, um clique duplo) passam
    // pela leitura acima, mas só uma acha o pedido pendente aqui. A outra volta inteira.
    const { count } = await tx.reivindicacao.updateMany({
      where: { id: reivindicacaoId, status: "pendente" },
      data: {
        status: "aprovada",
        revisadoPorId: revisorId,
        revisadoEm: new Date(),
        instagramUserId,
        instagramIgsid,
      },
    });
    if (count === 0) throw new ErroReivindicacao("Esta solicitação não está mais pendente.");
    await tx.reivindicacao.updateMany({
      where: { empresaId, usuarioId, status: "pendente", id: { not: reivindicacaoId } },
      data: { status: "cancelada" },
    });

    await registrarAuditoria(tx, {
      usuarioId: revisorId,
      acao: modo === "transferir" ? "reivindicacao.aprovada_com_transferencia" : "reivindicacao.aprovada",
      alvoTipo: "empresa",
      alvoId: empresaId,
      detalhes: `Reivindicação ${reivindicacaoId} (${reivindicacao.metodo}) do usuário ${usuarioId}.`,
    });
    for (const { usuarioId: removido } of semConfirmacao) {
      await registrarAuditoria(tx, {
        usuarioId: revisorId,
        acao: "empresa.dono_removido",
        alvoTipo: "empresa",
        alvoId: empresaId,
        detalhes: `Usuário ${removido}: outra pessoa confirmou pelo Instagram, e ele nunca tinha confirmado.`,
      });
    }
    return { empresaId, usuarios: semConfirmacao.map((m) => m.usuarioId) };
  });

  // O aviso sai aqui, depois da transação: a aprovação vem de ações, do login e do webhook.
  for (const usuarioId of removidos.usuarios) {
    await avisarDonoRemovido({ empresaId: removidos.empresaId, usuarioId, motivo: "confirmou_outro" });
  }
}

export async function recusar(params: { reivindicacaoId: string; revisorId: string; motivo: string }): Promise<void> {
  await db.$transaction(async (tx) => {
    const reivindicacao = await tx.reivindicacao.findUnique({ where: { id: params.reivindicacaoId } });
    if (!reivindicacao || reivindicacao.status !== "pendente") {
      throw new ErroReivindicacao("Esta solicitação não está mais pendente.");
    }
    await tx.reivindicacao.update({
      where: { id: params.reivindicacaoId },
      data: {
        status: "recusada",
        motivoRecusa: params.motivo,
        revisadoPorId: params.revisorId,
        revisadoEm: new Date(),
      },
    });
    await registrarAuditoria(tx, {
      usuarioId: params.revisorId,
      acao: "reivindicacao.recusada",
      alvoTipo: "empresa",
      alvoId: reivindicacao.empresaId,
      detalhes: `Reivindicação ${params.reivindicacaoId}: ${params.motivo}`,
    });
  });
}

export async function cancelar(reivindicacaoId: string, usuarioId: string): Promise<void> {
  await db.reivindicacao.updateMany({
    where: { id: reivindicacaoId, usuarioId, status: "pendente" },
    data: { status: "cancelada" },
  });
}

function linhaDeNota(texto: string): string {
  return `[${formatarDataHora(new Date())}] ${texto}`;
}

async function anotar(reivindicacaoId: string, texto: string) {
  const atual = await db.reivindicacao.findUnique({ where: { id: reivindicacaoId }, select: { notas: true } });
  const notas = [atual?.notas, linhaDeNota(texto)].filter(Boolean).join("\n");
  await db.reivindicacao.update({ where: { id: reivindicacaoId }, data: { notas } });
}
