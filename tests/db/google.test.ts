import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as entrarComGoogle } from "@/app/api/google/entrar/route";
import { GET as retornoDoGoogle } from "@/app/api/google/retorno/route";
import { contaDoGoogle, type PerfilGoogle } from "@/lib/auth/google";
import { db } from "@/lib/db";

// As rotas passam de verdade pelo banco. Só a sessão fica de mentira (o cookie
// dela precisa de uma requisição do Next) e o Google responde por um fetch falso.
const sessao = vi.hoisted(() => ({ criarSessao: vi.fn(), usuarioAtual: vi.fn(async () => null) }));
vi.mock("@/lib/auth/sessao", async (importarOriginal) => ({
  ...(await importarOriginal<typeof import("@/lib/auth/sessao")>()),
  ...sessao,
}));

const CLIENTE = "cliente.apps.googleusercontent.com";
const SITE = "http://localhost:3000";

function perfil(campos: Partial<PerfilGoogle> = {}): PerfilGoogle {
  return { sub: "google-ana", email: "ana@gmail.com", emailVerificado: true, nome: "Ana Lúcia Santos", ...campos };
}

async function criarConta(campos: { email?: string; emailConfirmadoEm?: Date | null; googleId?: string } = {}) {
  const conta = await db.usuario.create({
    data: { nome: "Ana de antes", email: "ana@gmail.com", senhaHash: "scrypt$senha-antiga", ...campos },
  });
  await db.sessao.create({ data: { id: `sessao-${conta.id}`, usuarioId: conta.id, expiraEm: new Date(Date.now() + 60_000) } });
  return conta;
}

const conta = (id: string) => db.usuario.findUniqueOrThrow({ where: { id } });
const sessoesDe = (usuarioId: string) => db.sessao.count({ where: { usuarioId } });

async function limparBanco() {
  await db.$executeRawUnsafe(`TRUNCATE "Sessao", "Usuario" CASCADE`);
}

beforeEach(async () => {
  await limparBanco();
  vi.clearAllMocks();
  vi.stubEnv("GOOGLE_CLIENT_ID", CLIENTE);
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "segredo");
  vi.stubEnv("APP_URL", SITE);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await limparBanco();
  await db.$disconnect();
});

describe("contaDoGoogle", () => {
  it("sem conta com o e-mail, cria uma já confirmada e sem senha", async () => {
    const resultado = await contaDoGoogle(perfil());
    expect(resultado.tipo).toBe("entrou");
    const nova = await db.usuario.findUniqueOrThrow({ where: { email: "ana@gmail.com" } });
    expect(resultado).toEqual({ tipo: "entrou", usuarioId: nova.id });
    expect(nova).toMatchObject({ nome: "Ana Lúcia Santos", googleId: "google-ana", senhaHash: null, papel: "membro" });
    expect(nova.emailConfirmadoEm).not.toBeNull();
  });

  it("a conta já ligada entra pelo Google mesmo depois de o e-mail mudar no Google", async () => {
    const ligada = await criarConta({ googleId: "google-ana" });
    expect(await contaDoGoogle(perfil({ email: "ana.nova@gmail.com" }))).toEqual({ tipo: "entrou", usuarioId: ligada.id });
    expect(await db.usuario.count()).toBe(1);
  });

  it("liga a conta de e-mail confirmado sem mexer na senha nem nas sessões", async () => {
    const confirmadaEm = new Date("2026-10-01T12:00:00Z");
    const existente = await criarConta({ emailConfirmadoEm: confirmadaEm });

    expect(await contaDoGoogle(perfil())).toEqual({ tipo: "entrou", usuarioId: existente.id });
    expect(await conta(existente.id)).toMatchObject({
      nome: "Ana de antes",
      googleId: "google-ana",
      senhaHash: "scrypt$senha-antiga",
      emailConfirmadoEm: confirmadaEm,
    });
    expect(await sessoesDe(existente.id)).toBe(1);
  });

  it("liga a conta de e-mail não confirmado apagando a senha e as sessões de quem a criou", async () => {
    const existente = await criarConta();

    expect(await contaDoGoogle(perfil())).toEqual({ tipo: "entrou", usuarioId: existente.id });
    const depois = await conta(existente.id);
    expect(depois).toMatchObject({ googleId: "google-ana", senhaHash: null });
    expect(depois.emailConfirmadoEm).not.toBeNull();
    expect(await sessoesDe(existente.id)).toBe(0);
  });

  it("com o e-mail não verificado pelo Google, não cria nem liga conta", async () => {
    expect(await contaDoGoogle(perfil({ emailVerificado: false }))).toEqual({ tipo: "email_nao_verificado" });
    expect(await db.usuario.count()).toBe(0);

    const existente = await criarConta();
    expect(await contaDoGoogle(perfil({ emailVerificado: false }))).toEqual({ tipo: "email_nao_verificado" });
    expect(await conta(existente.id)).toMatchObject({ googleId: null, senhaHash: "scrypt$senha-antiga" });
  });

  it("a conta já ligada entra mesmo se o Google deixar de dar o e-mail como verificado", async () => {
    const ligada = await criarConta({ googleId: "google-ana" });
    expect(await contaDoGoogle(perfil({ emailVerificado: false }))).toEqual({ tipo: "entrou", usuarioId: ligada.id });
  });

  it("não liga outro Google à conta que já tem um", async () => {
    const existente = await criarConta({ googleId: "google-outro" });
    expect(await contaDoGoogle(perfil())).toEqual({ tipo: "outra_conta_google" });
    expect(await conta(existente.id)).toMatchObject({ googleId: "google-outro", senhaHash: "scrypt$senha-antiga" });
    expect(await sessoesDe(existente.id)).toBe(1);
  });

  it("dois retornos ao mesmo tempo criam uma conta só", async () => {
    const [primeiro, segundo] = await Promise.all([contaDoGoogle(perfil()), contaDoGoogle(perfil())]);
    expect(primeiro).toEqual(segundo);
    expect(await db.usuario.count()).toBe(1);
  });

  it("dois retornos ao mesmo tempo ligam a conta uma vez", async () => {
    const existente = await criarConta();
    const resultados = await Promise.all([contaDoGoogle(perfil()), contaDoGoogle(perfil())]);
    expect(resultados).toEqual([
      { tipo: "entrou", usuarioId: existente.id },
      { tipo: "entrou", usuarioId: existente.id },
    ]);
  });
});

/** Cookie que /api/google/entrar grava: state, verificador e o voltar em base64url. */
function cookieDoLogin(voltar = "/indicar", estado = "estado-certo", verificador = "verificador-certo") {
  return `ndb_google=${estado}.${verificador}.${Buffer.from(voltar).toString("base64url")}`;
}

function retorno(busca: Record<string, string>, cookie = cookieDoLogin()) {
  const url = new URL("/api/google/retorno", SITE);
  url.search = new URLSearchParams(busca).toString();
  return retornoDoGoogle(new NextRequest(url, { headers: { cookie } }));
}

function googleResponde(campos: Record<string, unknown> = {}) {
  const parte = (valor: unknown) => Buffer.from(JSON.stringify(valor)).toString("base64url");
  const dados = {
    iss: "https://accounts.google.com",
    aud: CLIENTE,
    exp: Math.floor(Date.now() / 1000) + 3600,
    sub: "google-ana",
    email: "ana@gmail.com",
    email_verified: true,
    name: "Ana Lúcia Santos",
    ...campos,
  };
  const idToken = [parte({ alg: "RS256" }), parte(dados), "assinatura"].join(".");
  const fetch = vi.fn(async () => Response.json({ access_token: "token", id_token: idToken }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

const avisoDe = (resposta: Response) => new URL(resposta.headers.get("location")!).searchParams.get("aviso");

describe("/api/google/entrar", () => {
  it("manda para o Google com o state e o PKCE guardados no cookie", async () => {
    const resposta = await entrarComGoogle(new NextRequest(`${SITE}/api/google/entrar?voltar=%2Findicar%3Fx%3D1`));
    const destino = new URL(resposta.headers.get("location")!);
    expect(destino.origin).toBe("https://accounts.google.com");

    const [estado, verificador, voltar] = resposta.cookies.get("ndb_google")!.value.split(".");
    expect(destino.searchParams.get("state")).toBe(estado);
    expect(destino.searchParams.get("code_challenge")).toBe(createHash("sha256").update(verificador!).digest("base64url"));
    expect(Buffer.from(voltar!, "base64url").toString()).toBe("/indicar?x=1");
    expect(resposta.cookies.get("ndb_google")).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/api/google" });
  });

  it("não aceita um voltar para outro site", async () => {
    const resposta = await entrarComGoogle(new NextRequest(`${SITE}/api/google/entrar?voltar=%2F%2Foutro.exemplo`));
    const voltar = resposta.cookies.get("ndb_google")!.value.split(".")[2]!;
    expect(Buffer.from(voltar, "base64url").toString()).toBe("/");
  });

  it("sem a configuração do Google, volta para /entrar com o aviso", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    const resposta = await entrarComGoogle(new NextRequest(`${SITE}/api/google/entrar?voltar=%2Findicar`));
    expect(resposta.headers.get("location")).toBe(`${SITE}/entrar?voltar=%2Findicar&aviso=google_indisponivel`);
    expect(resposta.cookies.get("ndb_google")).toBeUndefined();
  });
});

describe("/api/google/retorno", () => {
  it("troca o código com o verificador, abre a sessão e volta para onde a pessoa estava", async () => {
    const fetch = googleResponde();
    const resposta = await retorno({ code: "codigo", state: "estado-certo" });

    expect(resposta.headers.get("location")).toBe(`${SITE}/indicar`);
    const [, opcoes] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    const corpo = new URLSearchParams(opcoes.body as URLSearchParams);
    expect(corpo.get("code")).toBe("codigo");
    expect(corpo.get("code_verifier")).toBe("verificador-certo");
    expect(corpo.get("redirect_uri")).toBe(`${SITE}/api/google/retorno`);

    const nova = await db.usuario.findUniqueOrThrow({ where: { email: "ana@gmail.com" } });
    expect(sessao.criarSessao).toHaveBeenCalledWith(nova.id);
    // O cookie do login é apagado.
    expect(resposta.cookies.get("ndb_google")?.value).toBe("");
  });

  it("com o state diferente do cookie, não fala com o Google nem abre sessão", async () => {
    const fetch = googleResponde();
    const resposta = await retorno({ code: "codigo", state: "estado-de-outra-pessoa" });
    expect(resposta.headers.get("location")).toBe(`${SITE}/entrar?voltar=%2Findicar&aviso=google_erro`);
    expect(fetch).not.toHaveBeenCalled();
    expect(sessao.criarSessao).not.toHaveBeenCalled();
  });

  it("sem o cookie do login, não abre sessão e volta para o começo", async () => {
    const fetch = googleResponde();
    const resposta = await retorno({ code: "codigo", state: "estado-certo" }, "");
    expect(resposta.headers.get("location")).toBe(`${SITE}/entrar?voltar=%2F&aviso=google_erro`);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("quando a pessoa cancela no Google, mostra o aviso de cancelado", async () => {
    googleResponde();
    expect(avisoDe(await retorno({ error: "access_denied", state: "estado-certo" }))).toBe("google_cancelado");
    expect(sessao.criarSessao).not.toHaveBeenCalled();
  });

  it("com o e-mail não verificado, mostra o aviso e não cria conta", async () => {
    googleResponde({ email_verified: false });
    expect(avisoDe(await retorno({ code: "codigo", state: "estado-certo" }))).toBe("google_email_nao_verificado");
    expect(await db.usuario.count()).toBe(0);
  });

  it("com o e-mail já ligado a outro Google, mostra o aviso", async () => {
    await criarConta({ googleId: "google-outro" });
    googleResponde();
    expect(avisoDe(await retorno({ code: "codigo", state: "estado-certo" }))).toBe("google_outra_conta");
    expect(sessao.criarSessao).not.toHaveBeenCalled();
  });

  it("quando o Google recusa o código, mostra o aviso de erro", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: "invalid_grant" }, { status: 400 })));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(avisoDe(await retorno({ code: "codigo", state: "estado-certo" }))).toBe("google_erro");
    expect(sessao.criarSessao).not.toHaveBeenCalled();
  });

  it("recusa o id_token feito para outro app", async () => {
    googleResponde({ aud: "outro.apps.googleusercontent.com" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(avisoDe(await retorno({ code: "codigo", state: "estado-certo" }))).toBe("google_erro");
    expect(await db.usuario.count()).toBe(0);
  });
});
