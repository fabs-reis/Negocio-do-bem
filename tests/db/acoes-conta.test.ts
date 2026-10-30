import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { cadastrar, entrar } from "@/acoes/conta";
import * as senha from "@/lib/auth/senha";
import { LIMITE_POR_EMAIL, LIMITE_POR_IP } from "@/lib/auth/tentativas";
import { db } from "@/lib/db";

// Estes testes passam pelas ações de verdade (entrar e cadastrar). Só o que
// precisa de uma requisição do Next fica de mentira: os cabeçalhos, o redirect,
// o cookie da sessão e o after (o e-mail de confirmação do cadastro). O scrypt é o de verdade, com espiões para contar quantas
// vezes ele roda: o limite existe para impedir justamente essas conferências.
const contexto = vi.hoisted(() => ({
  cabecalhos: {} as Record<string, string>,
  // Cabeçalhos das próximas chamadas, na ordem em que elas pedem os cabeçalhos.
  proximos: [] as Record<string, string>[],
}));
const criarSessao = vi.hoisted(() => vi.fn());
let erroDoOperador: MockInstance<typeof console.error>;

vi.mock("next/headers", () => ({ headers: async () => new Headers(contexto.proximos.shift() ?? contexto.cabecalhos) }));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("redirecionado");
  },
}));
vi.mock("next/server", () => ({ after: () => {} }));
vi.mock("@/lib/auth/sessao", () => ({ caminhoSeguro: () => "/", criarSessao, encerrarSessao: vi.fn() }));
vi.mock("@/lib/auth/senha", async (importarOriginal) => {
  const original = await importarOriginal<typeof import("@/lib/auth/senha")>();
  return {
    ...original,
    gerarHashSenha: vi.fn(original.gerarHashSenha),
    verificarSenha: vi.fn(original.verificarSenha),
  };
});

const SENHA_CERTA = "senha-certa-123";
const SENHA_ERRADA = "senha-errada-123";
const MENSAGEM_RECUSA = "E-mail ou senha incorretos.";
const MENSAGEM_LIMITE_CADASTRO = "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.";
const MENSAGEM_SEM_IP_ENTRAR = "Não foi possível entrar agora. Tente de novo mais tarde.";
const MENSAGEM_SEM_IP_CADASTRO = "Não foi possível criar a conta agora. Tente de novo mais tarde.";

function formulario(email: string, senhaDigitada = SENHA_ERRADA) {
  const dados = new FormData();
  dados.set("nome", "Pessoa de teste");
  dados.set("email", email);
  dados.set("senha", senhaDigitada);
  return dados;
}

/** Tenta entrar `vezes` vezes, cada uma com um e-mail novo, para só o limite por IP agir. */
async function entrarVezes(vezes: number, cabecalhosDaVez: (indice: number) => Record<string, string>) {
  const respostas = [];
  for (let indice = 0; indice < vezes; indice++) {
    contexto.cabecalhos = cabecalhosDaVez(indice);
    respostas.push(await entrar({}, formulario(`pessoa-${indice}@exemplo.com`)));
  }
  return respostas;
}

/** Tenta cadastrar `vezes` vezes, cada uma com um e-mail novo. Devolve as respostas que não foram redirect. */
async function cadastrarVezes(vezes: number, cabecalhosDaVez: (indice: number) => Record<string, string>) {
  const respostas = [];
  for (let indice = 0; indice < vezes; indice++) {
    contexto.cabecalhos = cabecalhosDaVez(indice);
    try {
      respostas.push(await cadastrar({}, formulario(`nova-${indice}@exemplo.com`, SENHA_CERTA)));
    } catch (erro) {
      if (!(erro instanceof Error) || erro.message !== "redirecionado") throw erro;
    }
  }
  return respostas;
}

async function criarUsuario(email: string) {
  const usuario = await db.usuario.create({ data: { nome: "Pessoa de teste", email, senhaHash: await senha.gerarHashSenha(SENHA_CERTA) } });
  vi.clearAllMocks();
  return usuario;
}

// O hash falso do entrar é calculado uma vez só e guardado no módulo. Aqui ele
// é calculado antes de todos os testes, para a contagem de gerarHashSenha não
// depender de qual teste roda primeiro.
beforeAll(async () => {
  await db.$executeRawUnsafe(`TRUNCATE "TentativaAcesso", "Usuario" CASCADE`);
  await entrar({}, formulario("aquecer@exemplo.com"));
  await db.$executeRawUnsafe(`TRUNCATE "TentativaAcesso", "Usuario" CASCADE`);
});

beforeEach(async () => {
  contexto.cabecalhos = {};
  contexto.proximos = [];
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("AUTENTICACAO_PROXY_CONFIAVEL", undefined);
  erroDoOperador = vi.spyOn(console, "error").mockImplementation(() => {});
  await db.$executeRawUnsafe(`TRUNCATE "TentativaAcesso", "Usuario" CASCADE`);
  vi.clearAllMocks();
});
afterEach(() => {
  erroDoOperador.mockRestore();
  vi.unstubAllEnvs();
});
afterAll(async () => {
  await db.$executeRawUnsafe(`TRUNCATE "TentativaAcesso", "Usuario" CASCADE`);
  await db.$disconnect();
});

describe("de onde vem o IP", () => {
  // O x-real-ip e o x-forwarded-for trazem um valor novo a cada tentativa: se algum deles valesse, o limite nunca agiria.
  const forjados = (i: number) => ({ "x-real-ip": `198.51.100.${i + 1}`, "x-forwarded-for": `192.0.2.${i + 1}, 203.0.113.${i + 1}` });

  /** Confere que nenhuma tentativa chegou ao scrypt, que o operador foi avisado e que o banco não guardou nada. */
  async function esperarRecusaSemIp(respostas: ({ erro?: string } | undefined)[], mensagem: string) {
    expect(respostas.map((r) => r?.erro)).toEqual(Array(respostas.length).fill(mensagem));
    expect(senha.verificarSenha).not.toHaveBeenCalled();
    expect(senha.gerarHashSenha).not.toHaveBeenCalled();
    expect(await db.tentativaAcesso.count()).toBe(0);
    expect(await db.usuario.count()).toBe(0);
    expect(erroDoOperador).toHaveBeenCalledTimes(respostas.length);
    for (const [aviso] of erroDoOperador.mock.calls) {
      expect(aviso).toContain("AUTENTICACAO_PROXY_CONFIAVEL");
      expect(aviso).toContain("CLOUDFLARE_DEPLOY=1");
      expect(aviso).toContain("cf-connecting-ip");
      expect(aviso).toContain("Publicando");
      expect(aviso).toContain("README");
    }
  }

  describe("no Vercel, com o x-vercel-forwarded-for", () => {
    it("o login usa só esse cabeçalho e ignora o x-real-ip e o x-forwarded-for", async () => {
      const respostas = await entrarVezes(LIMITE_POR_IP + 2, (i) => ({ "x-vercel-forwarded-for": "203.0.113.7", ...forjados(i) }));
      expect(senha.verificarSenha).toHaveBeenCalledTimes(LIMITE_POR_IP);
      expect(respostas.map((r) => r?.erro)).toEqual(Array(LIMITE_POR_IP + 2).fill(MENSAGEM_RECUSA));
    });

    it("o cadastro usa só esse cabeçalho e ignora o x-real-ip e o x-forwarded-for", async () => {
      const respostas = await cadastrarVezes(LIMITE_POR_IP + 2, (i) => ({ "x-vercel-forwarded-for": "203.0.113.7", ...forjados(i) }));
      expect(senha.gerarHashSenha).toHaveBeenCalledTimes(LIMITE_POR_IP);
      expect(respostas.map((r) => r?.erro)).toEqual(Array(2).fill(MENSAGEM_LIMITE_CADASTRO));
    });
  });

  describe("no Vercel, sem o x-vercel-forwarded-for", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "production");
    });

    it("o login é recusado antes do scrypt, mesmo com o x-forwarded-for e o x-real-ip", async () => {
      const respostas = await entrarVezes(3, forjados);
      await esperarRecusaSemIp(respostas, MENSAGEM_SEM_IP_ENTRAR);
    });

    it("o cadastro é recusado antes do scrypt, mesmo com o x-forwarded-for e o x-real-ip", async () => {
      const respostas = await cadastrarVezes(3, forjados);
      await esperarRecusaSemIp(respostas, MENSAGEM_SEM_IP_CADASTRO);
    });

    it("um x-vercel-forwarded-for que não é IP tem o mesmo resultado", async () => {
      const respostas = await entrarVezes(3, (i) => ({ "x-vercel-forwarded-for": i % 2 ? "nao-e-ip" : "", ...forjados(i) }));
      await esperarRecusaSemIp(respostas, MENSAGEM_SEM_IP_ENTRAR);
    });
  });

  describe("no Vercel e com AUTENTICACAO_PROXY_CONFIAVEL=1 ao mesmo tempo", () => {
    beforeEach(() => {
      vi.stubEnv("AUTENTICACAO_PROXY_CONFIAVEL", "1");
    });

    it("o login conta só o x-vercel-forwarded-for: o x-forwarded-for, que muda a cada tentativa, não vale", async () => {
      await entrarVezes(LIMITE_POR_IP + 2, (i) => ({ "x-vercel-forwarded-for": "203.0.113.7", ...forjados(i) }));
      expect(senha.verificarSenha).toHaveBeenCalledTimes(LIMITE_POR_IP);
    });

    it("o cadastro conta só o x-vercel-forwarded-for: o x-forwarded-for, que muda a cada tentativa, não vale", async () => {
      await cadastrarVezes(LIMITE_POR_IP + 2, (i) => ({ "x-vercel-forwarded-for": "203.0.113.7", ...forjados(i) }));
      expect(senha.gerarHashSenha).toHaveBeenCalledTimes(LIMITE_POR_IP);
    });

    it("sem o x-vercel-forwarded-for, o x-forwarded-for válido não serve de reserva: login e cadastro são recusados em produção", async () => {
      vi.stubEnv("NODE_ENV", "production");
      const entradas = await entrarVezes(2, () => ({ "x-forwarded-for": "203.0.113.7" }));
      const cadastros = await cadastrarVezes(2, () => ({ "x-forwarded-for": "203.0.113.7" }));
      expect(entradas.map((r) => r?.erro)).toEqual(Array(2).fill(MENSAGEM_SEM_IP_ENTRAR));
      expect(cadastros.map((r) => r?.erro)).toEqual(Array(2).fill(MENSAGEM_SEM_IP_CADASTRO));
      expect(senha.verificarSenha).not.toHaveBeenCalled();
      expect(senha.gerarHashSenha).not.toHaveBeenCalled();
      expect(await db.tentativaAcesso.count()).toBe(0);
    });
  });

  describe("fora do Vercel, com AUTENTICACAO_PROXY_CONFIAVEL=1", () => {
    beforeEach(() => {
      vi.stubEnv("VERCEL", undefined);
      vi.stubEnv("AUTENTICACAO_PROXY_CONFIAVEL", "1");
    });

    it("o login usa o último valor do x-forwarded-for, que é o que o proxy pôs", async () => {
      await entrarVezes(LIMITE_POR_IP + 2, (i) => ({
        "x-forwarded-for": `192.0.2.${i + 1}, 198.51.100.${i + 1}, 203.0.113.7`,
        "x-real-ip": `198.51.100.${i + 1}`,
        "x-vercel-forwarded-for": `203.0.113.${i + 100}`,
      }));
      expect(senha.verificarSenha).toHaveBeenCalledTimes(LIMITE_POR_IP);
      // Outro IP posto pelo proxy tem a cota própria.
      contexto.cabecalhos = { "x-forwarded-for": "203.0.113.8" };
      await entrar({}, formulario("outra-pessoa@exemplo.com"));
      expect(senha.verificarSenha).toHaveBeenCalledTimes(LIMITE_POR_IP + 1);
    });

    it("o cadastro usa o último valor do x-forwarded-for, que é o que o proxy pôs", async () => {
      await cadastrarVezes(LIMITE_POR_IP + 2, (i) => ({ "x-forwarded-for": `192.0.2.${i + 1}, 203.0.113.7` }));
      expect(senha.gerarHashSenha).toHaveBeenCalledTimes(LIMITE_POR_IP);
    });

    it("em produção, um último valor que não é IP é recusado antes do scrypt, no login e no cadastro", async () => {
      vi.stubEnv("NODE_ENV", "production");
      const entradas = await entrarVezes(3, (i) => ({ "x-forwarded-for": `203.0.113.7, ${i % 2 ? `nao-e-ip-${i}` : ""}` }));
      const cadastros = await cadastrarVezes(3, () => ({ "x-forwarded-for": "203.0.113.7, fe80::1%eth0" }));
      expect(entradas.map((r) => r?.erro)).toEqual(Array(3).fill(MENSAGEM_SEM_IP_ENTRAR));
      expect(cadastros.map((r) => r?.erro)).toEqual(Array(3).fill(MENSAGEM_SEM_IP_CADASTRO));
      expect(senha.verificarSenha).not.toHaveBeenCalled();
      expect(senha.gerarHashSenha).not.toHaveBeenCalled();
      expect(await db.tentativaAcesso.count()).toBe(0);
      expect(erroDoOperador).toHaveBeenCalledTimes(6);
    });

    it("em produção, sem o x-forwarded-for, também é recusado", async () => {
      vi.stubEnv("NODE_ENV", "production");
      const respostas = await entrarVezes(2, () => ({}));
      await esperarRecusaSemIp(respostas, MENSAGEM_SEM_IP_ENTRAR);
    });

    it("fora de produção, um último valor que não é IP deixa o IP sem limite", async () => {
      await entrarVezes(LIMITE_POR_IP + 2, (i) => ({ "x-forwarded-for": `203.0.113.7, nao-e-ip-${i}` }));
      expect(senha.verificarSenha).toHaveBeenCalledTimes(LIMITE_POR_IP + 2);
      expect(erroDoOperador).not.toHaveBeenCalled();
    });
  });

  describe("em produção, fora do Vercel e sem proxy declarado", () => {
    beforeEach(() => {
      vi.stubEnv("VERCEL", undefined);
      vi.stubEnv("NODE_ENV", "production");
    });

    it("o login é recusado antes do scrypt, e nenhum cabeçalho vale", async () => {
      const respostas = await entrarVezes(3, (i) => ({ "x-vercel-forwarded-for": `203.0.113.${i + 1}`, ...forjados(i) }));
      await esperarRecusaSemIp(respostas, MENSAGEM_SEM_IP_ENTRAR);
    });

    it("o cadastro é recusado antes do scrypt, e nenhum cabeçalho vale", async () => {
      const respostas = await cadastrarVezes(3, (i) => ({ "x-vercel-forwarded-for": `203.0.113.${i + 1}`, ...forjados(i) }));
      await esperarRecusaSemIp(respostas, MENSAGEM_SEM_IP_CADASTRO);
    });

    it("a senha certa também é recusada: a conferência nem acontece", async () => {
      await criarUsuario("ana@exemplo.com");
      const resposta = await entrar({}, formulario("ana@exemplo.com", SENHA_CERTA));
      expect(resposta?.erro).toBe(MENSAGEM_SEM_IP_ENTRAR);
      expect(senha.verificarSenha).not.toHaveBeenCalled();
      expect(criarSessao).not.toHaveBeenCalled();
      expect(await db.tentativaAcesso.count()).toBe(0);
    });
  });

  describe("em desenvolvimento, sem IP confiável", () => {
    beforeEach(() => {
      vi.stubEnv("VERCEL", undefined);
      vi.stubEnv("NODE_ENV", "development");
    });

    it("o login não tem limite por IP, e ninguém é avisado nem registrado", async () => {
      const respostas = await entrarVezes(LIMITE_POR_IP + 2, forjados);
      expect(senha.verificarSenha).toHaveBeenCalledTimes(LIMITE_POR_IP + 2);
      expect(respostas.map((r) => r?.erro)).toEqual(Array(LIMITE_POR_IP + 2).fill(MENSAGEM_RECUSA));
      expect(erroDoOperador).not.toHaveBeenCalled();
      // Só as linhas dos e-mails: nenhuma de IP.
      expect(await db.tentativaAcesso.count()).toBe(LIMITE_POR_IP + 2);
    });

    it("o cadastro não tem limite por IP", async () => {
      await cadastrarVezes(LIMITE_POR_IP + 2, forjados);
      expect(senha.gerarHashSenha).toHaveBeenCalledTimes(LIMITE_POR_IP + 2);
      expect(await db.usuario.count()).toBe(LIMITE_POR_IP + 2);
      expect(await db.tentativaAcesso.count()).toBe(0);
    });

    it("o limite por e-mail continua: a 6ª senha errada nem chega ao scrypt", async () => {
      await criarUsuario("ana@exemplo.com");
      const respostas = [];
      for (let i = 0; i < LIMITE_POR_EMAIL + 1; i++) respostas.push(await entrar({}, formulario("ana@exemplo.com")));
      expect(senha.verificarSenha).toHaveBeenCalledTimes(LIMITE_POR_EMAIL);
      expect(respostas.map((r) => r?.erro)).toEqual(Array(LIMITE_POR_EMAIL + 1).fill(MENSAGEM_RECUSA));
      // Com o limite do e-mail estourado, nem a senha certa entra.
      vi.clearAllMocks();
      const certa = await entrar({}, formulario("ana@exemplo.com", SENHA_CERTA));
      expect(certa?.erro).toBe(MENSAGEM_RECUSA);
      expect(senha.verificarSenha).not.toHaveBeenCalled();
    });
  });
});

describe("limite por e-mail", () => {
  it("só 5 tentativas do mesmo lugar chegam ao scrypt", async () => {
    await criarUsuario("ana@exemplo.com");
    contexto.cabecalhos = { "x-vercel-forwarded-for": "198.51.100.1" };
    const respostas = [];
    for (let i = 0; i < LIMITE_POR_EMAIL + 2; i++) respostas.push(await entrar({}, formulario("ana@exemplo.com")));
    expect(senha.verificarSenha).toHaveBeenCalledTimes(LIMITE_POR_EMAIL);
    expect(respostas.map((r) => r?.erro)).toEqual(Array(LIMITE_POR_EMAIL + 2).fill(MENSAGEM_RECUSA));
  });

  it("tentativas ao mesmo tempo, do mesmo lugar, também param em 5 no scrypt", async () => {
    await criarUsuario("ana@exemplo.com");
    contexto.cabecalhos = { "x-vercel-forwarded-for": "198.51.100.1" };
    const total = LIMITE_POR_IP;
    const respostas = await Promise.all(Array.from({ length: total }, () => entrar({}, formulario("ana@exemplo.com"))));
    expect(senha.verificarSenha).toHaveBeenCalledTimes(LIMITE_POR_EMAIL);
    expect(respostas.map((r) => r?.erro)).toEqual(Array(total).fill(MENSAGEM_RECUSA));
  });

  it("quem erra a senha de outra pessoa não bloqueia a dona da conta, que entra de outro lugar", async () => {
    const usuario = await criarUsuario("ana@exemplo.com");
    contexto.cabecalhos = { "x-vercel-forwarded-for": "198.51.100.1" };
    for (let i = 0; i < LIMITE_POR_EMAIL + 2; i++) await entrar({}, formulario("ana@exemplo.com"));

    contexto.cabecalhos = { "x-vercel-forwarded-for": "203.0.113.50" };
    await expect(entrar({}, formulario("ana@exemplo.com", SENHA_CERTA))).rejects.toThrow("redirecionado");
    expect(criarSessao).toHaveBeenCalledExactlyOnceWith(usuario.id);
  });

  it("cada lugar tem as próprias 5 tentativas para o mesmo e-mail", async () => {
    await criarUsuario("ana@exemplo.com");
    for (const ip of ["198.51.100.1", "198.51.100.2"]) {
      contexto.cabecalhos = { "x-vercel-forwarded-for": ip };
      for (let i = 0; i < LIMITE_POR_EMAIL + 1; i++) await entrar({}, formulario("ana@exemplo.com"));
    }
    expect(senha.verificarSenha).toHaveBeenCalledTimes(2 * LIMITE_POR_EMAIL);
  });
});

describe("o limite vale nas duas ações e vem antes do scrypt", () => {
  const vercel = { "x-vercel-forwarded-for": "203.0.113.7" };

  it("o cadastro para no limite por IP sem gerar o hash e sem criar conta", async () => {
    const respostas = await cadastrarVezes(LIMITE_POR_IP + 2, () => vercel);
    expect(senha.gerarHashSenha).toHaveBeenCalledTimes(LIMITE_POR_IP);
    expect(respostas.map((r) => r?.erro)).toEqual(Array(2).fill(MENSAGEM_LIMITE_CADASTRO));
    expect(await db.usuario.count()).toBe(LIMITE_POR_IP);
  });

  it("cadastro e login dividem a cota do mesmo IP", async () => {
    await cadastrarVezes(6, () => vercel);
    await entrarVezes(6, () => vercel);
    expect(senha.gerarHashSenha).toHaveBeenCalledTimes(6);
    expect(senha.verificarSenha).toHaveBeenCalledTimes(LIMITE_POR_IP - 6);
  });

  it("cadastros ao mesmo tempo, do mesmo IP, também geram só 10 hashes", async () => {
    contexto.cabecalhos = vercel;
    const respostas = await Promise.all(
      Array.from({ length: LIMITE_POR_IP + 5 }, (_, i) => cadastrar({}, formulario(`junto-${i}@exemplo.com`, SENHA_CERTA)).catch((erro: Error) => erro)),
    );
    expect(senha.gerarHashSenha).toHaveBeenCalledTimes(LIMITE_POR_IP);
    expect(respostas.filter((r) => r instanceof Error)).toHaveLength(LIMITE_POR_IP);
    expect(await db.usuario.count()).toBe(LIMITE_POR_IP);
  });

  it("depois do limite, nem a senha certa entra: a conferência nem acontece", async () => {
    await criarUsuario("ana@exemplo.com");
    contexto.cabecalhos = vercel;
    for (let i = 0; i < LIMITE_POR_IP; i++) await entrar({}, formulario(`outra-${i}@exemplo.com`));
    vi.clearAllMocks();
    const resposta = await entrar({}, formulario("ana@exemplo.com", SENHA_CERTA));
    expect(resposta?.erro).toBe(MENSAGEM_RECUSA);
    expect(senha.verificarSenha).not.toHaveBeenCalled();
    expect(criarSessao).not.toHaveBeenCalled();
  });

  it("depois do limite por e-mail, nem a senha certa entra do mesmo lugar: a conferência nem acontece", async () => {
    await criarUsuario("ana@exemplo.com");
    contexto.cabecalhos = { "x-vercel-forwarded-for": "198.51.100.1" };
    for (let i = 0; i < LIMITE_POR_EMAIL; i++) await entrar({}, formulario("ana@exemplo.com"));
    vi.clearAllMocks();
    const resposta = await entrar({}, formulario("ana@exemplo.com", SENHA_CERTA));
    expect(resposta?.erro).toBe(MENSAGEM_RECUSA);
    expect(senha.verificarSenha).not.toHaveBeenCalled();
    expect(criarSessao).not.toHaveBeenCalled();
  });

  it("no login, a recusa pelo IP, pelo e-mail e pela senha errada têm a mesma resposta", async () => {
    await criarUsuario("ana@exemplo.com");
    const senhaErrada = await entrar({}, formulario("ana@exemplo.com"));

    for (let i = 1; i < LIMITE_POR_EMAIL; i++) await entrar({}, formulario("ana@exemplo.com"));
    const porEmail = await entrar({}, formulario("ana@exemplo.com"));

    contexto.cabecalhos = { "x-vercel-forwarded-for": "203.0.113.99" };
    for (let i = 0; i < LIMITE_POR_IP; i++) await entrar({}, formulario(`outra-${i}@exemplo.com`));
    const porIp = await entrar({}, formulario("ana@exemplo.com"));

    expect(senhaErrada).toEqual({ erro: MENSAGEM_RECUSA, valores: expect.anything() });
    expect(porEmail).toEqual(senhaErrada);
    expect(porIp).toEqual(senhaErrada);
  });

  it("um login certo zera a contagem do e-mail naquele lugar e abre mais 5 tentativas", async () => {
    const usuario = await criarUsuario("ana@exemplo.com");
    contexto.cabecalhos = { "x-vercel-forwarded-for": "198.51.100.1" };
    for (let i = 0; i < LIMITE_POR_EMAIL - 1; i++) await entrar({}, formulario("ana@exemplo.com"));
    await expect(entrar({}, formulario("ana@exemplo.com", SENHA_CERTA))).rejects.toThrow("redirecionado");
    expect(criarSessao).toHaveBeenCalledExactlyOnceWith(usuario.id);

    vi.clearAllMocks();
    for (let i = 0; i < LIMITE_POR_EMAIL; i++) await entrar({}, formulario("ana@exemplo.com"));
    expect(senha.verificarSenha).toHaveBeenCalledTimes(LIMITE_POR_EMAIL);
  });

  it("o banco guarda só o hash do IP e do e-mail", async () => {
    contexto.cabecalhos = vercel;
    await entrar({}, formulario("privado@exemplo.com"));
    const chaves = (await db.tentativaAcesso.findMany()).map((t) => t.chave);
    expect(chaves).toHaveLength(2);
    for (const chave of chaves) {
      expect(chave).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

describe("IPv6", () => {
  it("os endereços do mesmo prefixo /64 dividem a cota, mesmo com o IPv6 escrito de jeitos diferentes", async () => {
    const respostas = await entrarVezes(LIMITE_POR_IP + 2, (i) => ({
      "x-vercel-forwarded-for": i % 2 ? `2001:db8:abcd:12::${i + 1}` : `2001:0DB8:ABCD:0012:${i + 1}:ffff:ffff:ffff`,
    }));
    expect(senha.verificarSenha).toHaveBeenCalledTimes(LIMITE_POR_IP);
    expect(respostas.map((r) => r?.erro)).toEqual(Array(LIMITE_POR_IP + 2).fill(MENSAGEM_RECUSA));
    // Outro prefixo /64 tem a cota própria.
    contexto.cabecalhos = { "x-vercel-forwarded-for": "2001:db8:abcd:13::1" };
    await entrar({}, formulario("outra-pessoa@exemplo.com"));
    expect(senha.verificarSenha).toHaveBeenCalledTimes(LIMITE_POR_IP + 1);
  });

  it("o IPv4 escrito como IPv6 divide a cota com o IPv4", async () => {
    await entrarVezes(LIMITE_POR_IP + 2, (i) => ({ "x-vercel-forwarded-for": i % 2 ? "::ffff:203.0.113.5" : "203.0.113.5" }));
    expect(senha.verificarSenha).toHaveBeenCalledTimes(LIMITE_POR_IP);
  });

  it("o cadastro também divide a cota por prefixo /64", async () => {
    await cadastrarVezes(LIMITE_POR_IP + 2, (i) => ({ "x-vercel-forwarded-for": `2001:db8:abcd:12::${i + 1}` }));
    expect(senha.gerarHashSenha).toHaveBeenCalledTimes(LIMITE_POR_IP);
  });
});
