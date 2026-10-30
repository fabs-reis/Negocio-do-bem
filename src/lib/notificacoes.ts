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
import { hrefModeracao } from "@/lib/moderacao/filtros";
import { ENDERECO_DO_SITE, NOME_DO_SITE } from "@/lib/seo";

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] || nome;
}

function corpo(...paragrafos: string[]): string {
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

/**
 * Para quem pediu para redefinir a senha: o link que vale por uma hora. O link passa
 * por uma rota que guarda o token num cookie e abre a página sem ele na URL, para o
 * token não ir parar no Google Analytics. Sem o envio configurado, no desenvolvimento
 * o link sai no terminal; nos previews e na produção, ninguém recebe nada.
 */
export async function avisarRedefinicaoDeSenha(usuarioId: string, token: string): Promise<void> {
  const usuario = await db.usuario.findUnique({ where: { id: usuarioId }, select: { nome: true, email: true } });
  if (!usuario) return;
  const link = `${ENDERECO_DO_SITE}/api/redefinir-senha?token=${encodeURIComponent(token)}`;
  if (!envioLigado()) {
    if (process.env.NODE_ENV === "development") console.info(`[redefinição de senha] ${usuario.email}: ${link}`);
    return;
  }
  await enviarEmail({
    para: usuario.email,
    assunto: `Redefina a sua senha no ${NOME_DO_SITE}`,
    texto: corpo(
      `Olá, ${primeiroNome(usuario.nome)}!`,
      `Recebemos um pedido para redefinir a senha da sua conta. Para escolher uma senha nova, abra o link abaixo. Ele vale por uma hora e só funciona uma vez:\n${link}`,
      "Não foi você? É só ignorar este e-mail: a sua senha continua a mesma.",
    ),
  });
}
