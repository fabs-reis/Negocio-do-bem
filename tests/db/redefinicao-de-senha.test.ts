import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { criarSenhaComLink, pedirRedefinicaoDeSenha, usarLinkDoEmail } from "@/acoes/conta";
import { COOKIE_LINK, criarLink, enviarLink, lerLink, redefinirSenhaComLink } from "@/lib/auth/links";
import { gerarHashSenha, verificarSenha } from "@/lib/auth/senha";
import { LIMITE_POR_EMAIL, LIMITE_POR_IP, reservarTentativaDoEmail } from "@/lib/auth/tentativas";
import { db } from "@/lib/db";
import { enviarEmail, type Email } from "@/lib/email";

// Passa pelas ações de verdade. Só o que precisa de uma requisição do Next fica de mentira.
const contexto = vi.hoisted(() => ({
  cabecalhos: { "x-vercel-forwarded-for": "203.0.113.7" } as Record<string, string>,
  cookies: new Map<string, string>(),
  depois: [] as (() => unknown)[],
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(contexto.cabecalhos),
  cookies: async () => ({
    get: (nome: string) => (contexto.cookies.has(nome) ? { value: contexto.cookies.get(nome) } : undefined),
    delete: ({ name }: { name: string }) => contexto.cookies.delete(name),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`redirecionado:${destino}`);
  },
}));
vi.mock("next/server", () => ({ after: (tarefa: () => unknown) => contexto.depois.push(tarefa) }));
vi.mock("@/lib/auth/sessao", () => ({ caminhoSeguro: () => "/", criarSessao: vi.fn(), encerrarSessao: vi.fn() }));
vi.mock("@/lib/email", () => ({ envioLigado: vi.fn(() => true), enviarEmail: vi.fn(async () => true) }));

const enviados = () => vi.mocked(enviarEmail).mock.calls.map(([email]) => email as Email);

/** Roda o que a ação deixou para depois da resposta, como o `after` faz. */
async function rodarDepois() {
  for (const tarefa of contexto.depois.splice(0)) await tarefa();
}

/** A mensagem do redirect, ou null se a ação voltou sem redirecionar. */
async function redirecionou(promessa: Promise<unknown>) {
  try {
    await promessa;
  } catch (erro) {
    return (erro as Error).message;
  }
  return null;
}

function dadosEmail(email: string) {
  const dados = new FormData();
  dados.set("email", email);
  return dados;
}

function dadosSenha(senha: string) {
  const dados = new FormData();
  dados.set("senha", senha);
  return dados;
}

async function criarConta(email = "ana@exemplo.com", senha = "senha-antiga-123") {
  return db.usuario.create({
    data: { nome: "Ana Souza", email, senhaHash: await gerarHashSenha(senha) },
    select: { id: true, nome: true, email: true },
  });
}

async function limparBanco() {
  await db.$executeRawUnsafe(`TRUNCATE "LinkEmail", "TentativaAcesso", "RegistroAuditoria", "Sessao", "Usuario" CASCADE`);
}

beforeEach(async () => {
  await limparBanco();
  contexto.cookies.clear();
  contexto.depois.length = 0;
  contexto.cabecalhos = { "x-vercel-forwarded-for": "203.0.113.7" };
  vi.stubEnv("VERCEL", "1");
  vi.mocked(enviarEmail).mockClear();
});

afterAll(async () => {
  await limparBanco();
  await db.$disconnect();
});

describe("redefinirSenhaComLink", () => {
  it("troca a senha, encerra as sessões e grava a auditoria", async () => {
    const ana = await criarConta();
    await db.sessao.create({ data: { id: "s1", usuarioId: ana.id, expiraEm: new Date(Date.now() + 60_000) } });
    const token = (await criarLink(ana, "redefinir"))!;

    expect(await redefinirSenhaComLink(token, "senha-nova-456")).toEqual(ana);

    const conta = await db.usuario.findUniqueOrThrow({ where: { id: ana.id } });
    expect(await verificarSenha("senha-nova-456", conta.senhaHash)).toBe(true);
    expect(await verificarSenha("senha-antiga-123", conta.senhaHash)).toBe(false);
    expect(conta.emailConfirmadoEm).not.toBeNull();
    expect(await db.sessao.count()).toBe(0);
    expect(await db.registroAuditoria.findFirstOrThrow()).toMatchObject({
      usuarioId: ana.id,
      acao: "usuario.senha_redefinida",
      alvoTipo: "usuario",
      alvoId: ana.id,
    });
  });

  it("o link vale uma vez só, mesmo com três envios ao mesmo tempo", async () => {
    const ana = await criarConta();
    const token = (await criarLink(ana, "redefinir"))!;

    const resultados = await Promise.all([
      redefinirSenhaComLink(token, "senha-nova-111"),
      redefinirSenhaComLink(token, "senha-nova-222"),
      redefinirSenhaComLink(token, "senha-nova-333"),
    ]);
    expect(resultados.filter(Boolean)).toHaveLength(1);
    expect(await db.registroAuditoria.count()).toBe(1);
  });

  it("gasta os outros links da conta, inclusive o de entrar", async () => {
    const ana = await criarConta();
    const token = (await criarLink(ana, "redefinir"))!;
    const entrar = (await criarLink(ana, "entrar"))!;
    const outroRedefinir = (await criarLink(ana, "redefinir"))!;

    await redefinirSenhaComLink(token, "senha-nova-456");

    expect(await lerLink(entrar)).toBeNull();
    expect(await lerLink(outroRedefinir)).toBeNull();
  });

  it("não mexe nos links de outra conta", async () => {
    const ana = await criarConta();
    const bia = await criarConta("bia@exemplo.com");
    const token = (await criarLink(ana, "redefinir"))!;
    const deBia = (await criarLink(bia, "entrar"))!;

    await redefinirSenhaComLink(token, "senha-nova-456");
    expect(await lerLink(deBia)).not.toBeNull();
  });

  it("não aceita link vencido, de outra finalidade nem token inventado", async () => {
    const ana = await criarConta();
    const vencido = (await criarLink(ana, "redefinir"))!;
    await db.linkEmail.updateMany({ data: { expiraEm: new Date(Date.now() - 1000) } });
    const deEntrar = (await criarLink(ana, "entrar"))!;
    const deConfirmar = (await criarLink(ana, "confirmar"))!;

    expect(await redefinirSenhaComLink(vencido, "senha-nova-456")).toBeNull();
    expect(await redefinirSenhaComLink(deEntrar, "senha-nova-456")).toBeNull();
    expect(await redefinirSenhaComLink(deConfirmar, "senha-nova-456")).toBeNull();
    expect(await redefinirSenhaComLink("inventado", "senha-nova-456")).toBeNull();
    const conta = await db.usuario.findUniqueOrThrow({ where: { id: ana.id } });
    expect(await verificarSenha("senha-antiga-123", conta.senhaHash)).toBe(true);
  });

  it("o link de redefinir vale por 1 hora", async () => {
    const ana = await criarConta();
    await criarLink(ana, "redefinir");
    const link = await db.linkEmail.findFirstOrThrow();
    expect(Math.round((link.expiraEm.getTime() - link.criadoEm.getTime()) / 60_000)).toBe(60);
  });

  it("dois links pedidos em seguida valem os dois, até um ser usado", async () => {
    const ana = await criarConta();
    const primeiro = (await criarLink(ana, "redefinir"))!;
    const segundo = (await criarLink(ana, "redefinir"))!;
    expect(await lerLink(primeiro)).not.toBeNull();
    expect(await lerLink(segundo)).not.toBeNull();
  });
});

describe("o e-mail do link", () => {
  it("manda o link de senha nova", async () => {
    const ana = await criarConta();
    await enviarLink(ana, "redefinir", "tok123");
    expect(enviados()).toHaveLength(1);
    expect(enviados()[0]).toMatchObject({ para: "ana@exemplo.com" });
    expect(enviados()[0]!.assunto).toContain("senha nova");
    expect(enviados()[0]!.texto).toContain("/api/link?t=tok123");
  });
});

describe("pedirRedefinicaoDeSenha", () => {
  it("responde igual com ou sem conta, e só manda o e-mail depois da resposta", async () => {
    await criarConta();
    const comConta = await redirecionou(pedirRedefinicaoDeSenha({}, dadosEmail("ana@exemplo.com")));
    const semConta = await redirecionou(pedirRedefinicaoDeSenha({}, dadosEmail("ninguem@exemplo.com")));
    expect(comConta).toBe("redirecionado:/entrar?aviso=redefinicao_pedida");
    expect(semConta).toBe(comConta);
    expect(enviados()).toHaveLength(0);
    expect(await db.linkEmail.count()).toBe(0);

    await rodarDepois();
    expect(enviados()).toHaveLength(1);
    expect(enviados()[0]!.para).toBe("ana@exemplo.com");
    expect((await db.linkEmail.findFirstOrThrow()).finalidade).toBe("redefinir");
  });

  it("recusa e-mail inválido", async () => {
    const resposta = await pedirRedefinicaoDeSenha({}, dadosEmail("isso-nao-e-email"));
    expect(resposta?.erros?.email).toBeTruthy();
  });

  it("para no limite por IP, sem criar link nem mandar e-mail", async () => {
    await criarConta();
    for (let i = 0; i < LIMITE_POR_IP; i++) await redirecionou(pedirRedefinicaoDeSenha({}, dadosEmail(`x${i}@exemplo.com`)));
    const resposta = await pedirRedefinicaoDeSenha({}, dadosEmail("ana@exemplo.com"));
    expect(resposta?.erro).toMatch(/Muitos pedidos/);
    await rodarDepois();
    expect(enviados()).toHaveLength(0);
    expect(await db.linkEmail.count()).toBe(0);
  });

  it("cada conta recebe no máximo 5 links por hora, mesmo de IPs diferentes", async () => {
    await criarConta();
    for (let i = 0; i < 8; i++) {
      contexto.cabecalhos = { "x-vercel-forwarded-for": `203.0.113.${10 + i}` };
      await redirecionou(pedirRedefinicaoDeSenha({}, dadosEmail("ana@exemplo.com")));
      await rodarDepois();
    }
    expect(enviados()).toHaveLength(5);
  });
});

describe("criarSenhaComLink", () => {
  it("troca a senha, apaga o cookie, zera as tentativas de todas as origens e avisa a dona", async () => {
    const ana = await criarConta();
    contexto.cookies.set(COOKIE_LINK, (await criarLink(ana, "redefinir"))!);
    for (const ip of ["198.51.100.1", "198.51.100.2"]) {
      for (let i = 0; i < LIMITE_POR_EMAIL; i++) await reservarTentativaDoEmail("ana@exemplo.com", ip);
      expect(await reservarTentativaDoEmail("ana@exemplo.com", ip)).toBe(false);
    }

    expect(await redirecionou(criarSenhaComLink({}, dadosSenha("senha-nova-456")))).toBe("redirecionado:/entrar?aviso=senha_redefinida");

    expect(contexto.cookies.has(COOKIE_LINK)).toBe(false);
    for (const ip of ["198.51.100.1", "198.51.100.2", null]) expect(await reservarTentativaDoEmail("ana@exemplo.com", ip)).toBe(true);
    await rodarDepois();
    expect(enviados()).toHaveLength(1);
    expect(enviados()[0]).toMatchObject({ para: "ana@exemplo.com" });
    expect(enviados()[0]!.assunto).toContain("foi trocada");
  });

  it("não zera as tentativas de outro e-mail", async () => {
    const ana = await criarConta();
    for (let i = 0; i < LIMITE_POR_EMAIL; i++) await reservarTentativaDoEmail("bia@exemplo.com", "198.51.100.1");
    contexto.cookies.set(COOKIE_LINK, (await criarLink(ana, "redefinir"))!);
    await redirecionou(criarSenhaComLink({}, dadosSenha("senha-nova-456")));
    expect(await reservarTentativaDoEmail("bia@exemplo.com", "198.51.100.1")).toBe(false);
  });

  it("recusa senha curta sem gastar o link", async () => {
    const ana = await criarConta();
    const token = (await criarLink(ana, "redefinir"))!;
    contexto.cookies.set(COOKIE_LINK, token);
    const resposta = await criarSenhaComLink({}, dadosSenha("curta"));
    expect(resposta?.erros?.senha).toBeTruthy();
    expect(await lerLink(token)).not.toBeNull();
  });

  it("sem cookie ou com link gasto, mostra o erro e não troca nada", async () => {
    const ana = await criarConta();
    expect((await criarSenhaComLink({}, dadosSenha("senha-nova-456")))?.erro).toMatch(/venceu/);

    const token = (await criarLink(ana, "redefinir"))!;
    await redefinirSenhaComLink(token, "senha-nova-456");
    contexto.cookies.set(COOKIE_LINK, token);
    expect((await criarSenhaComLink({}, dadosSenha("outra-senha-789")))?.erro).toMatch(/venceu/);
    const conta = await db.usuario.findUniqueOrThrow({ where: { id: ana.id } });
    expect(await verificarSenha("senha-nova-456", conta.senhaHash)).toBe(true);
  });

  it("passa pelo limite por IP, porque calcula o scrypt", async () => {
    const ana = await criarConta();
    for (let i = 0; i < LIMITE_POR_IP; i++) await criarSenhaComLink({}, dadosSenha("senha-nova-456"));
    contexto.cookies.set(COOKIE_LINK, (await criarLink(ana, "redefinir"))!);
    expect((await criarSenhaComLink({}, dadosSenha("senha-nova-456")))?.erro).toMatch(/Muitas tentativas/);
  });
});

describe("usarLinkDoEmail", () => {
  it("não gasta um link de redefinir: ele só se usa trocando a senha", async () => {
    const ana = await criarConta();
    const token = (await criarLink(ana, "redefinir"))!;
    contexto.cookies.set(COOKIE_LINK, token);

    expect(await redirecionou(usarLinkDoEmail())).toBe("redirecionado:/link");
    expect(await lerLink(token)).not.toBeNull();
    expect((await db.usuario.findUniqueOrThrow({ where: { id: ana.id } })).emailConfirmadoEm).toBeNull();
  });
});
