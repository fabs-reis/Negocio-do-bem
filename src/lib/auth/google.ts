// "Continuar com o Google": entrar e criar conta pelo OpenID Connect do Google.
//
// É o fluxo de código de autorização com PKCE. O Google manda a pessoa de volta
// para /api/google/retorno com um código, e o servidor troca o código pelo id_token
// direto com o Google. Como o id_token vem do próprio Google por HTTPS, e não pelo
// navegador, a assinatura não precisa ser conferida (OpenID Connect Core 3.1.3.7):
// conferimos o emissor, o destinatário e a validade.
//
// Documentação: https://developers.google.com/identity/openid-connect/openid-connect

import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";

/** Cookie que guarda o "state", o verificador do PKCE e o `voltar` até o retorno. */
export const COOKIE_GOOGLE = "ndb_google";

export type ConfigGoogle = { clientId: string; clientSecret: string; redirectUri: string };

export function configGoogle(): ConfigGoogle | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.APP_URL;
  if (!clientId || !clientSecret || !appUrl) return null;
  return { clientId, clientSecret, redirectUri: `${appUrl.replace(/\/+$/, "")}/api/google/retorno` };
}

export function urlAutorizacao(config: ConfigGoogle, estado: string, verificador: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    // Só o necessário para a conta: quem é, o e-mail e o nome.
    scope: "openid email profile",
    state: estado,
    code_challenge: createHash("sha256").update(verificador).digest("base64url"),
    code_challenge_method: "S256",
    // Mostra a escolha de conta, para quem tem mais de uma no navegador.
    prompt: "select_account",
  }).toString();
  return url.toString();
}

export type PerfilGoogle = { sub: string; email: string; emailVerificado: boolean; nome: string };

export async function trocarCodigo(config: ConfigGoogle, codigo: string, verificador: string): Promise<PerfilGoogle> {
  const resposta = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
      code: codigo,
      code_verifier: verificador,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const idToken = objeto(await resposta.json().catch(() => null))?.id_token;
  if (!resposta.ok || typeof idToken !== "string") {
    throw new Error(`O Google não aceitou o código de autorização (HTTP ${resposta.status}).`);
  }
  return lerIdToken(idToken, config.clientId);
}

/** Lê o id_token que veio direto do Google. Lança erro se ele não for para este site ou já venceu. */
export function lerIdToken(idToken: string, clientId: string, agora = Date.now()): PerfilGoogle {
  const partes = idToken.split(".");
  let dados: Record<string, unknown> | null = null;
  try {
    dados = partes.length === 3 ? objeto(JSON.parse(Buffer.from(partes[1]!, "base64url").toString("utf8"))) : null;
  } catch {
    dados = null;
  }
  if (!dados) throw new Error("O id_token do Google veio num formato desconhecido.");

  const { iss, aud, exp, sub, email } = dados;
  if (iss !== "https://accounts.google.com" && iss !== "accounts.google.com") throw new Error("id_token de outro emissor.");
  if (aud !== clientId) throw new Error("id_token emitido para outro app.");
  if (typeof exp !== "number" || exp * 1000 <= agora) throw new Error("id_token vencido.");
  if (typeof sub !== "string" || !sub || typeof email !== "string" || !email.includes("@")) {
    throw new Error("id_token sem a conta ou sem o e-mail.");
  }

  const emailMinusculo = email.trim().toLowerCase();
  const nome = [dados.name, dados.given_name].find((v): v is string => typeof v === "string" && v.trim().length >= 2);
  return {
    sub,
    email: emailMinusculo,
    emailVerificado: dados.email_verified === true || dados.email_verified === "true",
    nome: (nome ?? emailMinusculo.split("@")[0]!).trim().slice(0, 80),
  };
}

export type ResultadoGoogle =
  | { tipo: "entrou"; usuarioId: string }
  | { tipo: "email_nao_verificado" }
  | { tipo: "outra_conta_google" };

/**
 * Acha a conta da pessoa que entrou pelo Google, ligando ou criando quando precisa:
 * 1. a conta já ligada a este Google entra;
 * 2. a conta com o mesmo e-mail é ligada a ele. Se o e-mail dela não estava confirmado,
 *    quem criou a conta nunca provou ser dono do endereço: a senha é apagada e as
 *    sessões abertas são encerradas, para ninguém criar a conta antes com o e-mail
 *    de outra pessoa e continuar com acesso depois que ela entrar pelo Google;
 * 3. sem conta com o e-mail, uma nova é criada, com o e-mail confirmado e sem senha.
 * Ligar e criar só valem com o e-mail verificado pelo Google.
 */
export async function contaDoGoogle(perfil: PerfilGoogle, tentativa = 1): Promise<ResultadoGoogle> {
  const ligada = await db.usuario.findUnique({ where: { googleId: perfil.sub }, select: { id: true } });
  if (ligada) return { tipo: "entrou", usuarioId: ligada.id };
  if (!perfil.emailVerificado) return { tipo: "email_nao_verificado" };

  const existente = await db.usuario.findUnique({
    where: { email: perfil.email },
    select: { id: true, googleId: true, emailConfirmadoEm: true },
  });
  // Dois retornos ao mesmo tempo: o outro ligou ou criou a conta primeiro, e a nova
  // leitura acha a conta dele.
  const deNovo = () => {
    if (tentativa > 1) throw new Error("A conta mudou durante o login com o Google.");
    return contaDoGoogle(perfil, tentativa + 1);
  };

  if (!existente) {
    try {
      const nova = await db.usuario.create({
        data: { nome: perfil.nome, email: perfil.email, googleId: perfil.sub, emailConfirmadoEm: new Date() },
        select: { id: true },
      });
      return { tipo: "entrou", usuarioId: nova.id };
    } catch (erro) {
      if (violouUnicidade(erro)) return deNovo();
      throw erro;
    }
  }
  if (existente.googleId) return { tipo: "outra_conta_google" };

  const confirmada = existente.emailConfirmadoEm !== null;
  const ligou = await db.$transaction(async (tx) => {
    // Só liga se nada mudou desde a leitura: nem outro Google, nem o e-mail, nem a confirmação.
    const { count } = await tx.usuario.updateMany({
      where: { id: existente.id, email: perfil.email, googleId: null, emailConfirmadoEm: existente.emailConfirmadoEm },
      data: confirmada ? { googleId: perfil.sub } : { googleId: perfil.sub, emailConfirmadoEm: new Date(), senhaHash: null },
    });
    if (count === 0) return false;
    if (!confirmada) await tx.sessao.deleteMany({ where: { usuarioId: existente.id } });
    return true;
  });
  return ligou ? { tipo: "entrou", usuarioId: existente.id } : deNovo();
}

function violouUnicidade(erro: unknown): boolean {
  return typeof erro === "object" && erro !== null && "code" in erro && erro.code === "P2002";
}

function objeto(valor: unknown): Record<string, unknown> | null {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? (valor as Record<string, unknown>) : null;
}
