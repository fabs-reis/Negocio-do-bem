import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { CONFIRMACAO_DE_EMAIL_LIGADA } from "@/lib/auth/links";
import { db } from "@/lib/db";

const COOKIE = "ndb_sessao";
const DURACAO_MS = 30 * 24 * 60 * 60 * 1000;
const DURACAO_MODERADOR_MS = 8 * 60 * 60 * 1000;
const INATIVIDADE_MODERADOR_MS = 15 * 60 * 1000;
const ATUALIZACAO_ATIVIDADE_MS = 60 * 1000;
const REAUTENTICACAO_MS = 5 * 60 * 1000;

export type UsuarioSessao = {
  id: string;
  nome: string;
  email: string;
  moderador: boolean;
  temPapelModeracao?: boolean;
  // Indicar, escrever e denunciar depoimentos e reivindicar pedem o e-mail confirmado.
  // Com CONFIRMACAO_DE_EMAIL_LIGADA desligada, é sempre true.
  emailConfirmado: boolean;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Só o papel gravado no banco dá moderação, nunca o e-mail: quem se cadastrasse
 * com o endereço certo antes da pessoa levaria a moderação, e as contas antigas
 * nem confirmaram o e-mail. Para dar ou tirar: `npm run moderacao`.
 */
export function ehModerador(usuario: { papel: string }): boolean {
  return usuario.papel === "moderador";
}

/** Cria a sessão e grava o cookie. Só pode ser chamada em Server Actions e Route Handlers. */
export async function criarSessao(usuarioId: string): Promise<void> {
  const { papel } = await db.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: { papel: true } });
  const token = randomBytes(32).toString("base64url");
  const expiraEm = new Date(Date.now() + (papel === "moderador" ? DURACAO_MODERADOR_MS : DURACAO_MS));
  await db.sessao.create({ data: { id: hashToken(token), usuarioId, expiraEm } });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiraEm,
  });
}

export async function encerrarSessao(): Promise<void> {
  const loja = await cookies();
  const token = loja.get(COOKIE)?.value;
  if (token) await db.sessao.deleteMany({ where: { id: hashToken(token) } });
  loja.delete(COOKIE);
}

/** Id (o sha256 do token) da sessão desta requisição, ou null. Serve para manter só ela ao trocar a senha. */
export async function idDaSessaoAtual(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? hashToken(token) : null;
}

/**
 * Uma única leitura por requisição. Contenção é feita consultando o banco,
 * nunca confiando no papel ou em um MFA embutido no cookie.
 */
export const sessaoAtual = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const sessao = await db.sessao.findUnique({
    where: { id: hashToken(token) },
    include: { usuario: true },
  });
  if (!sessao) return null;
  const agora = new Date();
  if (sessao.expiraEm <= agora) return null;

  if (ehModerador(sessao.usuario)) {
    if (
      agora.getTime() - sessao.criadoEm.getTime() >= DURACAO_MODERADOR_MS ||
      agora.getTime() - sessao.ultimaAtividadeEm.getTime() >= INATIVIDADE_MODERADOR_MS
    ) return null;

    if (agora.getTime() - sessao.ultimaAtividadeEm.getTime() >= ATUALIZACAO_ATIVIDADE_MS) {
      const { count } = await db.sessao.updateMany({
        where: { id: sessao.id, expiraEm: { gt: agora }, ultimaAtividadeEm: { gt: new Date(agora.getTime() - INATIVIDADE_MODERADOR_MS) } },
        data: { ultimaAtividadeEm: agora },
      });
      if (!count) return null;
    }
  }
  return sessao;
});

export const usuarioAtual = cache(async (): Promise<UsuarioSessao | null> => {
  const sessao = await sessaoAtual();
  if (!sessao) return null;
  const { usuario } = sessao;
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    // O privilégio só existe após MFA validado no servidor.
    moderador: ehModerador(usuario) && usuario.mfaAtivadoEm !== null && sessao.mfaVerificadoEm !== null,
    temPapelModeracao: ehModerador(usuario),
    emailConfirmado: !CONFIRMACAO_DE_EMAIL_LIGADA || usuario.emailConfirmadoEm !== null,
  };
});

/** Exige login; senão manda para /entrar e volta para `voltarPara` depois. */
export async function exigirUsuario(voltarPara: string): Promise<UsuarioSessao> {
  const usuario = await usuarioAtual();
  if (!usuario) redirect(`/entrar?voltar=${encodeURIComponent(voltarPara)}`);
  return usuario;
}

/** Nunca concede moderação baseada apenas no login primário. */
export async function exigirModerador(): Promise<UsuarioSessao> {
  const sessao = await sessaoAtual();
  if (!sessao) redirect("/entrar?voltar=%2Fmoderacao");
  if (!ehModerador(sessao.usuario)) notFound();
  if (sessao.usuario.mfaAtivadoEm === null || sessao.mfaVerificadoEm === null) {
    redirect("/seguranca/mfa?voltar=%2Fmoderacao");
  }
  return (await usuarioAtual())!;
}

/** Exige MFA recente (step-up) antes de decisões administrativas de grande impacto. */
export async function exigirModeradorRecente(voltarPara = "/moderacao"): Promise<UsuarioSessao> {
  const moderador = await exigirModerador();
  const sessao = await sessaoAtual();
  if (!sessao?.mfaVerificadoEm || Date.now() - sessao.mfaVerificadoEm.getTime() >= REAUTENTICACAO_MS) {
    redirect("/seguranca/mfa?revalidar=1&voltar=" + encodeURIComponent(caminhoSeguro(voltarPara, "/moderacao")));
  }
  return moderador;
}

/**
 * Aceita só caminhos internos, para o ?voltar= não virar um redirecionamento aberto.
 * Recusa autoridades, barras invertidas e controles antes de conferir a origem da URL (padrão WHATWG).
 * O TAB, o LF e o CR somem na interpretação, então "/<TAB>/host" viraria "//host", uma URL de outro site.
 */
export function caminhoSeguro(valor: unknown, padrao = "/"): string {
  if (
    typeof valor !== "string" ||
    !valor.startsWith("/") ||
    valor.startsWith("//") ||
    /[\\\u0000-\u001f\u007f]/.test(valor)
  ) {
    return padrao;
  }
  const origem = "http://origem.invalid";
  try {
    if (new URL(valor, origem).origin !== origem) return padrao;
  } catch {
    return padrao;
  }
  return valor;
}
