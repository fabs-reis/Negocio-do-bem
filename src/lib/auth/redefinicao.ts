import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { gerarHashSenha } from "@/lib/auth/senha";
import { db } from "@/lib/db";

/** Quanto tempo o link do e-mail vale. */
export const VALIDADE_MS = 60 * 60 * 1000;
/** Um novo link só sai depois disso, para ninguém encher a caixa de entrada de outra pessoa. */
export const INTERVALO_ENTRE_PEDIDOS_MS = 60 * 1000;

const COOKIE = "ndb_redefinicao";

/** Guarda o token do link num cookie, para a página de nova senha abrir sem ele na URL. */
export async function guardarTokenDeRedefinicao(token: string): Promise<void> {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: VALIDADE_MS / 1000,
  });
}

export async function lerTokenDeRedefinicao(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE)?.value;
}

export async function apagarTokenDeRedefinicao(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Cria o link de redefinição de uma conta e devolve o token, que só vai no e-mail.
 * Cada conta tem no máximo um link válido: o novo invalida o anterior. Devolve null
 * quando já saiu um link há menos de um minuto.
 */
export async function criarTokenDeRedefinicao(usuarioId: string): Promise<string | null> {
  const recente = await db.redefinicaoSenha.findFirst({
    where: { usuarioId, criadoEm: { gt: new Date(Date.now() - INTERVALO_ENTRE_PEDIDOS_MS) } },
    select: { id: true },
  });
  if (recente) return null;

  const token = randomBytes(32).toString("base64url");
  await db.$transaction([
    db.redefinicaoSenha.deleteMany({ where: { usuarioId } }),
    db.redefinicaoSenha.create({ data: { id: hashToken(token), usuarioId, expiraEm: new Date(Date.now() + VALIDADE_MS) } }),
  ]);
  return token;
}

/** O link ainda vale? Não gasta o token: quem confirma é `redefinirSenha`. */
export async function tokenDeRedefinicaoValido(token: string): Promise<boolean> {
  const registro = await db.redefinicaoSenha.findUnique({ where: { id: hashToken(token) }, select: { expiraEm: true } });
  return Boolean(registro && registro.expiraEm > new Date());
}

/**
 * Troca a senha de quem tem o link e encerra todas as sessões da conta: quem
 * entrou com a senha antiga (ou com ela vazada) perde o acesso. O link vale uma
 * vez só, e o `deleteMany` garante isso mesmo com dois envios ao mesmo tempo.
 * Devolve false quando o link não existe, venceu ou já foi usado.
 */
export async function redefinirSenha(token: string, novaSenha: string): Promise<boolean> {
  const id = hashToken(token);
  const registro = await db.redefinicaoSenha.findUnique({ where: { id } });
  if (!registro || registro.expiraEm <= new Date()) return false;

  const senhaHash = await gerarHashSenha(novaSenha);
  return db.$transaction(async (tx) => {
    const { count } = await tx.redefinicaoSenha.deleteMany({ where: { id, expiraEm: { gt: new Date() } } });
    if (count === 0) return false;
    await tx.redefinicaoSenha.deleteMany({ where: { usuarioId: registro.usuarioId } });
    await tx.usuario.update({ where: { id: registro.usuarioId }, data: { senhaHash } });
    await tx.sessao.deleteMany({ where: { usuarioId: registro.usuarioId } });
    return true;
  });
}
