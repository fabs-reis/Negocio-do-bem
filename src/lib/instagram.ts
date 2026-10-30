// Integração com o Instagram (Instagram API with Instagram Login).
//
// Dois usos, ambos opcionais e ligados por variáveis de ambiente:
// 1. "Entrar com Instagram": o dono faz login na conta profissional do negócio e
//    o Instagram nos diz qual @ ele controla.
// 2. Webhook de mensagens: quando alguém manda DM com o código de verificação
//    para o perfil oficial, descobrimos o @ de quem enviou e confirmamos sozinhos.
//
// Documentação: https://developers.facebook.com/docs/instagram-platform

import { createHmac, timingSafeEqual } from "node:crypto";
import { INSTAGRAM_DO_PROJETO } from "@/lib/dominio";

const HOST_GRAPH = "https://graph.instagram.com";

// Caminhos de instagram.com que não são perfis.
const ROTAS_RESERVADAS = new Set(["p", "reel", "reels", "explore", "stories", "accounts", "direct", "tv"]);

/**
 * Aceita "@fulano", "fulano" ou um link do perfil e devolve "fulano".
 * Retorna null se não parecer um @ válido do Instagram.
 */
export function normalizarUsername(entrada: unknown): string | null {
  if (typeof entrada !== "string") return null;
  let valor = entrada.trim();
  const link = valor.match(/instagram\.com\/([^/?#\s]+)/i);
  if (link) valor = link[1]!;
  valor = valor.replace(/^@+/, "").toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(valor)) return null;
  if (valor.startsWith(".") || valor.endsWith(".") || valor.includes("..")) return null;
  if (ROTAS_RESERVADAS.has(valor)) return null;
  return valor;
}

export function linkPerfil(username: string): string {
  return `https://www.instagram.com/${username}/`;
}

/**
 * @ que recebe as DMs com código: o INSTAGRAM_PERFIL_OFICIAL ou, vazio, o do projeto.
 * Null só quando a variável não é um @ válido, e aí o código por DM fica desligado.
 */
export function perfilOficial(): string | null {
  return normalizarUsername(process.env.INSTAGRAM_PERFIL_OFICIAL || INSTAGRAM_DO_PROJETO);
}

function versaoGraph(): string {
  return process.env.INSTAGRAM_GRAPH_VERSION || "v25.0";
}

// ---------------------------------------------------------------------------
// Entrar com Instagram (OAuth)
// ---------------------------------------------------------------------------

/** Cookie que guarda o "state" do OAuth e o negócio sendo reivindicado. */
export const COOKIE_ESTADO = "ndb_ig_estado";

export type ConfigLogin = { appId: string; appSecret: string; redirectUri: string };

export function configLogin(): ConfigLogin | null {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const appUrl = process.env.APP_URL;
  if (!appId || !appSecret || !appUrl) return null;
  return { appId, appSecret, redirectUri: `${appUrl.replace(/\/+$/, "")}/api/instagram/retorno` };
}

export function urlAutorizacao(config: ConfigLogin, estado: string): string {
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.search = new URLSearchParams({
    client_id: config.appId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    // Só precisamos saber quem é a conta: nenhuma permissão de publicar ou ler DMs.
    scope: "instagram_business_basic",
    state: estado,
    // Pede o login de novo, para a pessoa escolher a conta do negócio
    // mesmo que o navegador esteja logado em outra.
    force_reauth: "true",
  }).toString();
  return url.toString();
}

export async function trocarCodigoPorToken(config: ConfigLogin, codigo: string): Promise<string> {
  const resposta = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: config.appId,
      client_secret: config.appSecret,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
      code: codigo,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const json = objeto(await resposta.json().catch(() => null));
  // A resposta já veio como objeto simples e como { data: [ ... ] }; aceitamos as duas.
  const dados = Array.isArray(json?.data) ? objeto(json.data[0]) : json;
  const token = dados?.access_token;
  if (!resposta.ok || typeof token !== "string") {
    throw new Error(`O Instagram não aceitou o código de autorização (HTTP ${resposta.status}).`);
  }
  return token;
}

export type ContaInstagram = { userId: string; username: string };

/** Pergunta ao Instagram qual conta acabou de autorizar o login. */
export async function buscarContaConectada(token: string): Promise<ContaInstagram> {
  const url = new URL(`${HOST_GRAPH}/${versaoGraph()}/me`);
  url.searchParams.set("fields", "user_id,username");
  url.searchParams.set("access_token", token);
  const resposta = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  const json = objeto(await resposta.json().catch(() => null));
  const userId = json?.user_id;
  const username = normalizarUsername(json?.username);
  if (!resposta.ok || (typeof userId !== "string" && typeof userId !== "number") || !username) {
    throw new Error(`Não foi possível ler a conta conectada (HTTP ${resposta.status}).`);
  }
  return { userId: String(userId), username };
}

// ---------------------------------------------------------------------------
// Webhook de DMs
// ---------------------------------------------------------------------------

export type ConfigWebhook = { appSecret: string; verifyToken: string; accessToken: string };

export function configWebhook(): ConfigWebhook | null {
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const verifyToken = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!appSecret || !verifyToken || !accessToken) return null;
  return { appSecret, verifyToken, accessToken };
}

/** Confere o cabeçalho X-Hub-Signature-256 que a Meta envia em cada notificação. */
export function assinaturaValida(corpo: string, assinatura: string | null, appSecret: string): boolean {
  if (!assinatura?.startsWith("sha256=")) return false;
  const esperada = Buffer.from(createHmac("sha256", appSecret).update(corpo, "utf8").digest("hex"), "utf8");
  const recebida = Buffer.from(assinatura.slice("sha256=".length), "utf8");
  return esperada.length === recebida.length && timingSafeEqual(esperada, recebida);
}

export type MensagemRecebida = { remetenteId: string; texto: string };

/** Extrai as DMs de texto recebidas (ignorando as que nós mesmos enviamos). */
export function extrairMensagens(payload: unknown): MensagemRecebida[] {
  const mensagens: MensagemRecebida[] = [];
  const entradas = objeto(payload)?.entry;
  if (!Array.isArray(entradas)) return mensagens;
  for (const entrada of entradas) {
    const eventos = objeto(entrada)?.messaging;
    if (!Array.isArray(eventos)) continue;
    for (const evento of eventos) {
      const mensagem = objeto(objeto(evento)?.message);
      const remetente = objeto(objeto(evento)?.sender)?.id;
      if (!mensagem || mensagem.is_echo === true || typeof mensagem.text !== "string") continue;
      if (typeof remetente !== "string" && typeof remetente !== "number") continue;
      mensagens.push({ remetenteId: String(remetente), texto: mensagem.text });
    }
  }
  return mensagens;
}

/** Descobre o @ de quem mandou a DM (User Profile API). Null se não der. */
export async function buscarUsernamePorIgsid(igsid: string, accessToken: string): Promise<string | null> {
  try {
    const url = new URL(`${HOST_GRAPH}/${versaoGraph()}/${encodeURIComponent(igsid)}`);
    url.searchParams.set("fields", "username");
    url.searchParams.set("access_token", accessToken);
    const resposta = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!resposta.ok) return null;
    return normalizarUsername(objeto(await resposta.json())?.username);
  } catch {
    return null;
  }
}

function objeto(valor: unknown): Record<string, unknown> | null {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? (valor as Record<string, unknown>) : null;
}
