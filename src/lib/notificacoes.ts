// Avisos por e-mail: quem recebe o quê, e o texto de cada um.
//
// Cada pessoa recebe o próprio e-mail, para ninguém ver o endereço de outra. Os
// avisos para a moderação não levam dados pessoais: só o negócio e o link da fila,
// onde o resto já aparece para quem tem acesso.
//
// As Server Actions chamam estas funções dentro de `after()`, depois da resposta.
// Sem o envio configurado (`src/lib/email.ts`), elas não mandam nada.

import "server-only";
import { db } from "@/lib/db";
import { enviarEmail, envioLigado } from "@/lib/email";
import { prazoDaConfirmacao } from "@/lib/donos";
import { perfilOficial } from "@/lib/instagram";
import { hrefModeracao } from "@/lib/moderacao/filtros";
import { ENDERECO_DO_SITE, NOME_DO_SITE } from "@/lib/seo";

export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] || nome;
}

export function corpo(...paragrafos: string[]): string {
  return [...paragrafos, NOME_DO_SITE].join("\n\n");
}

async function emailsDaModeracao(): Promise<string[]> {
  const moderadores = await db.usuario.findMany({ where: { papel: "moderador" }, select: { email: true } });
  return moderadores.map((m) => m.email);
}

async function avisarModeracao(assunto: string, texto: string): Promise<void> {
  for (const para of await emailsDaModeracao()) await enviarEmail({ para, assunto, texto });
}

/** Para quem pediu: a moderação aprovou ou recusou a reivindicação. */
export async function avisarDecisaoDaReivindicacao(reivindicacaoId: string): Promise<void> {
  if (!envioLigado()) return;
  const pedido = await db.reivindicacao.findUnique({
    where: { id: reivindicacaoId },
    include: {
      usuario: { select: { nome: true, email: true } },
      empresa: { select: { nome: true, instagramUsername: true } },
    },
  });
  if (!pedido) return;
  const { usuario, empresa } = pedido;
  const ola = `Olá, ${primeiroNome(usuario.nome)}!`;

  if (pedido.status === "aprovada") {
    await enviarEmail({
      para: usuario.email,
      assunto: `Você agora é dono de ${empresa.nome} no ${NOME_DO_SITE}`,
      texto: corpo(
        ola,
        `A moderação aprovou o seu pedido: agora você é dono do perfil de ${empresa.nome} (@${empresa.instagramUsername}).`,
        `No painel, você conta a história do negócio, troca a foto e responde aos depoimentos:\n${ENDERECO_DO_SITE}/painel/${empresa.instagramUsername}`,
      ),
    });
  } else if (pedido.status === "recusada") {
    await enviarEmail({
      para: usuario.email,
      assunto: `Seu pedido para ${empresa.nome} não foi aprovado`,
      texto: corpo(
        ola,
        `A moderação analisou o seu pedido para assumir o perfil de ${empresa.nome} (@${empresa.instagramUsername}) e não aprovou desta vez.`,
        `Motivo: ${pedido.motivoRecusa ?? "não informado."}`,
        `Você acompanha os seus pedidos no painel:\n${ENDERECO_DO_SITE}/painel`,
      ),
    });
  }
}

/**
 * Para o dono que nunca confirmou: a moderação pede que ele confirme. O código não
 * vai no e-mail: o e-mail só prova acesso ao e-mail de quem assumiu o perfil.
 */
export async function avisarPedidoDeConfirmacao(par: { empresaId: string; usuarioId: string }): Promise<void> {
  if (!envioLigado()) return;
  const membro = await db.empresaMembro.findUnique({
    where: { empresaId_usuarioId: par },
    include: {
      usuario: { select: { nome: true, email: true } },
      empresa: { select: { nome: true, instagramUsername: true } },
    },
  });
  if (!membro?.confirmacaoPedidaEm || membro.confirmadoEm) return;
  const { usuario, empresa } = membro;
  const prazo = prazoDaConfirmacao(membro.confirmacaoPedidaEm).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const projeto = perfilOficial();
  await enviarEmail({
    para: usuario.email,
    assunto: `Confirme que você cuida de ${empresa.nome} no ${NOME_DO_SITE}`,
    texto: corpo(
      `Olá, ${primeiroNome(usuario.nome)}!`,
      `Estamos confirmando quem cuida de cada perfil. Você assumiu o perfil de ${empresa.nome} (@${empresa.instagramUsername}) sem confirmar pelo Instagram do negócio, e por isso a edição está pausada.`,
      `Para confirmar, abra a página abaixo e peça o código.${projeto ? ` Depois, pelo Instagram do negócio, siga o @${projeto} e mande um "Oi": a gente responde com o código nessa conversa.` : ""} Sem acesso ao Instagram do negócio, peça uma análise manual na mesma página.\n${ENDERECO_DO_SITE}/empresas/${empresa.instagramUsername}/reivindicar`,
      `O prazo vai até ${prazo}. Depois disso, se não houver um pedido em andamento, o perfil volta a ficar sem dono, livre para quem cuida do negócio.`,
    ),
  });
}

/** Para quem deixou de ser dono sem ter confirmado: pelo prazo ou porque outra pessoa confirmou pelo Instagram. */
export async function avisarDonoRemovido(par: {
  empresaId: string;
  usuarioId: string;
  motivo: "prazo" | "confirmou_outro";
}): Promise<void> {
  if (!envioLigado()) return;
  const [usuario, empresa] = await Promise.all([
    db.usuario.findUnique({ where: { id: par.usuarioId }, select: { nome: true, email: true } }),
    db.empresa.findUnique({ where: { id: par.empresaId }, select: { nome: true, instagramUsername: true } }),
  ]);
  if (!usuario || !empresa) return;
  await enviarEmail({
    para: usuario.email,
    assunto: `Você não cuida mais do perfil de ${empresa.nome} no ${NOME_DO_SITE}`,
    texto: corpo(
      `Olá, ${primeiroNome(usuario.nome)}!`,
      par.motivo === "prazo"
        ? `O prazo para confirmar que você cuida de ${empresa.nome} (@${empresa.instagramUsername}) acabou, e o perfil voltou a ficar sem dono.`
        : `Outra pessoa confirmou pelo Instagram do negócio que cuida de ${empresa.nome} (@${empresa.instagramUsername}), e o perfil passou para ela.`,
      `Se você cuida do negócio, confirme pelo Instagram ou peça uma análise manual:\n${ENDERECO_DO_SITE}/empresas/${empresa.instagramUsername}/reivindicar`,
    ),
  });
}

/** Para a moderação: um pedido de reivindicação ficou na fila para ela decidir. */
export async function avisarNovaReivindicacao(empresaId: string): Promise<void> {
  if (!envioLigado()) return;
  const empresa = await db.empresa.findUnique({ where: { id: empresaId }, select: { nome: true, instagramUsername: true } });
  if (!empresa) return;
  await avisarModeracao(
    `Novo pedido de reivindicação: @${empresa.instagramUsername}`,
    corpo(
      `Um pedido para assumir o perfil de ${empresa.nome} (@${empresa.instagramUsername}) está esperando a moderação.`,
      `Veja na fila de reivindicações:\n${ENDERECO_DO_SITE}${hrefModeracao("reivindicacoes")}`,
    ),
  );
}

/** Para a moderação: um depoimento foi denunciado. */
export async function avisarNovaDenuncia(depoimentoId: string): Promise<void> {
  if (!envioLigado()) return;
  const depoimento = await db.depoimento.findUnique({
    where: { id: depoimentoId },
    select: { empresa: { select: { nome: true, instagramUsername: true } } },
  });
  if (!depoimento) return;
  const { empresa } = depoimento;
  await avisarModeracao(
    `Depoimento denunciado em ${empresa.nome}`,
    corpo(
      `Um depoimento no perfil de ${empresa.nome} (@${empresa.instagramUsername}) foi denunciado e está esperando a moderação.`,
      `Veja na fila de denúncias:\n${ENDERECO_DO_SITE}${hrefModeracao("denuncias")}`,
    ),
  );
}

/** Para os donos: chegou um depoimento novo no negócio. */
export async function avisarNovoDepoimento(depoimentoId: string): Promise<void> {
  if (!envioLigado()) return;
  const depoimento = await db.depoimento.findUnique({
    where: { id: depoimentoId },
    include: {
      autor: { select: { nome: true } },
      empresa: {
        select: {
          nome: true,
          instagramUsername: true,
          membros: { select: { usuario: { select: { nome: true, email: true } } } },
        },
      },
    },
  });
  if (!depoimento) return;
  const { autor, empresa } = depoimento;
  for (const { usuario } of empresa.membros) {
    await enviarEmail({
      para: usuario.email,
      assunto: `Novo depoimento em ${empresa.nome}`,
      texto: corpo(
        `Olá, ${primeiroNome(usuario.nome)}!`,
        `${autor.nome} deixou um depoimento no perfil de ${empresa.nome}:`,
        `"${depoimento.texto}"`,
        `Você pode responder pelo painel:\n${ENDERECO_DO_SITE}/painel/${empresa.instagramUsername}#depoimentos`,
      ),
    });
  }
}
