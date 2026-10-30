import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";

// A sessão e o redirecionamento dependem do Next. Aqui o usuário é fixo
// e o redirecionamento vira uma exceção, como na Server Action de verdade.
const sessao = vi.hoisted(() => ({ usuario: null as { id: string; nome: string; email: string; moderador: boolean; emailConfirmado: boolean } | null }));

class Redirecionou extends Error {}

vi.mock("@/lib/auth/sessao", () => ({
  exigirUsuario: async () => sessao.usuario,
  caminhoSeguro: (valor: unknown, padrao = "/") => (typeof valor === "string" ? valor : padrao),
}));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Redirecionou(destino);
  },
}));
// O aviso para a moderação sai depois da resposta: aqui ele não sai.
vi.mock("next/server", () => ({ after: () => {} }));

const { indicarEmpresa } = await import("@/acoes/empresas");

const LIMITE = 10;
const DIA = 24 * 60 * 60 * 1000;

async function limparBanco() {
  await db.$executeRawUnsafe(
    `TRUNCATE "RegistroAuditoria", "Depoimento", "Reivindicacao", "EmpresaMembro", "EmpresaCausa", "Empresa", "Sessao", "Usuario" CASCADE`,
  );
}

let contador = 0;
async function criarUsuarioLogado() {
  contador++;
  const usuario = await db.usuario.create({
    data: { nome: "Pessoa", email: `indicadora${contador}@exemplo.com`, senhaHash: "x" },
  });
  sessao.usuario = { id: usuario.id, nome: usuario.nome, email: usuario.email, moderador: false, emailConfirmado: true };
  return usuario;
}

async function indicacoesAnteriores(usuarioId: string, quantas: number, criadoEm = new Date()) {
  for (let i = 0; i < quantas; i++) {
    await db.empresa.create({
      data: {
        instagramUsername: `antiga.${usuarioId.slice(-8)}.${i}`,
        nome: `Antiga ${i}`,
        resumo: "Um negócio do bem",
        categoria: "Serviços",
        cidade: "Recife",
        uf: "PE",
        moderacao: "aprovada",
        indicadaPorId: usuarioId,
        criadoEm,
      },
    });
  }
}

function formulario(instagram: string) {
  const dados = new FormData();
  dados.set("instagram", instagram);
  dados.set("nome", `Negócio ${instagram}`);
  dados.set("categoria", "Alimentação");
  dados.set("municipio", "Recife, PE");
  dados.set("resumo", "Um negócio do bem do bairro");
  return dados;
}

/** Envia uma indicação e diz como ela terminou: publicada (redirect, com o destino) ou o estado devolvido. */
async function indicar(instagram: string, dados = formulario(instagram)) {
  try {
    const estado = await indicarEmpresa({}, dados);
    return { publicada: false as const, estado: estado ?? {} };
  } catch (erro) {
    if (erro instanceof Redirecionou) return { publicada: true as const, destino: erro.message };
    throw erro;
  }
}

const publicadas = (resultados: Awaited<ReturnType<typeof indicar>>[]) => resultados.filter((r) => r.publicada).length;

beforeEach(limparBanco);
afterAll(async () => {
  await limparBanco();
  await db.$disconnect();
});

describe("cota diária de indicações", () => {
  it("em série, recusa a indicação depois da décima", async () => {
    const usuario = await criarUsuarioLogado();
    await indicacoesAnteriores(usuario.id, LIMITE - 1);

    const primeira = await indicar("nova.um");
    const segunda = await indicar("nova.dois");

    expect(primeira.publicada).toBe(true);
    expect(segunda.publicada).toBe(false);
    if (!segunda.publicada) expect(segunda.estado.erro).toMatch(/muitas indicações hoje/);
    expect(await db.empresa.count({ where: { indicadaPorId: usuario.id } })).toBe(LIMITE);
  });

  it("não conta indicações de mais de 24 horas", async () => {
    const usuario = await criarUsuarioLogado();
    await indicacoesAnteriores(usuario.id, LIMITE, new Date(Date.now() - DIA - 60_000));

    const resultado = await indicar("nova.depois.do.dia");

    expect(resultado.publicada).toBe(true);
  });

  it("com envios simultâneos e usernames diferentes, nunca passa de dez em 24 horas", async () => {
    // A corrida é por tempo: repete com contas novas para a falha não depender da sorte.
    for (let rodada = 0; rodada < 4; rodada++) {
      const usuario = await criarUsuarioLogado();
      await indicacoesAnteriores(usuario.id, LIMITE - 1);

      const resultados = await Promise.all(Array.from({ length: 8 }, (_, i) => indicar(`disputa.${rodada}.n${i}`)));

      expect(publicadas(resultados), `rodada ${rodada}`).toBe(1);
      expect(await db.empresa.count({ where: { indicadaPorId: usuario.id } }), `rodada ${rodada}`).toBe(LIMITE);
      expect(
        await db.registroAuditoria.count({ where: { usuarioId: usuario.id, acao: "empresa.indicada" } }),
        `rodada ${rodada}`,
      ).toBe(1);
    }
  });

  it("com a conta vazia e envios simultâneos, publica exatamente dez", async () => {
    const usuario = await criarUsuarioLogado();

    const resultados = await Promise.all(Array.from({ length: 10 }, (_, i) => indicar(`vazia.n${i}`)));
    const mais = await Promise.all(Array.from({ length: 6 }, (_, i) => indicar(`vazia.extra${i}`)));

    expect(publicadas(resultados)).toBe(LIMITE);
    expect(publicadas(mais)).toBe(0);
    expect(await db.empresa.count({ where: { indicadaPorId: usuario.id } })).toBe(LIMITE);
  });
});

describe("falha na auditoria da indicação", () => {
  it("propaga P2002 da auditoria e desfaz o negócio sem consumir a cota", async () => {
    const usuario = await criarUsuarioLogado();
    await indicacoesAnteriores(usuario.id, LIMITE - 1);
    const registro = await db.registroAuditoria.create({
      data: { id: "auditoria-repetida", usuarioId: usuario.id, acao: "teste", alvoTipo: "usuario", alvoId: usuario.id },
    });

    await db.$executeRawUnsafe(`
      CREATE FUNCTION "repetirIdAuditoriaIndicacaoTeste"() RETURNS trigger AS $$
      BEGIN
        IF NEW.acao = 'empresa.indicada' THEN
          NEW.id := 'auditoria-repetida';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    try {
      await db.$executeRawUnsafe(`
        CREATE TRIGGER "repetirIdAuditoriaIndicacaoTeste"
        BEFORE INSERT ON "RegistroAuditoria"
        FOR EACH ROW EXECUTE FUNCTION "repetirIdAuditoriaIndicacaoTeste"()
      `);
      const dados = formulario("auditoria.falha");
      dados.append("causas", "negocio-de-bairro");
      const [resultado] = await Promise.allSettled([indicarEmpresa({}, dados)]);

      expect(await db.empresa.findUnique({ where: { instagramUsername: "auditoria.falha" } })).toBeNull();
      expect(await db.empresaCausa.count()).toBe(0);
      expect(await db.empresa.count({ where: { indicadaPorId: usuario.id } })).toBe(LIMITE - 1);
      expect(await db.registroAuditoria.findMany()).toEqual([registro]);
      expect(resultado).toMatchObject({ status: "rejected", reason: { code: "P2002" } });
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS "repetirIdAuditoriaIndicacaoTeste" ON "RegistroAuditoria"');
      await db.$executeRawUnsafe('DROP FUNCTION "repetirIdAuditoriaIndicacaoTeste"()');
    }

    expect((await indicar("auditoria.falha")).publicada).toBe(true);
    expect(await db.empresa.count({ where: { indicadaPorId: usuario.id } })).toBe(LIMITE);
    expect(await db.registroAuditoria.count({ where: { usuarioId: usuario.id, acao: "empresa.indicada" } })).toBe(1);
  });
});

describe("indicação do mesmo username ao mesmo tempo", () => {
  it("publica uma vez e avisa a outra pessoa que o negócio já existe", async () => {
    await criarUsuarioLogado();

    const resultados = await Promise.all(Array.from({ length: 4 }, () => indicar("mesmo.username")));

    expect(publicadas(resultados)).toBe(1);
    for (const r of resultados) {
      if (!r.publicada) expect(r.estado.erros?.instagram).toMatch(/já está no Negócio do Bem/);
    }
    expect(await db.empresa.count({ where: { instagramUsername: "mesmo.username" } })).toBe(1);
  });
});

describe("sem o e-mail confirmado", () => {
  async function semEmailConfirmado() {
    const usuario = await criarUsuarioLogado();
    sessao.usuario = { ...sessao.usuario!, emailConfirmado: false };
    return usuario;
  }

  it("quem indica guarda as respostas na conta e não publica", async () => {
    const usuario = await semEmailConfirmado();

    const resultado = await indicar("padaria.flor");

    expect(resultado).toMatchObject({ publicada: false, estado: { rascunhoGuardado: true } });
    expect(await db.empresa.count({ where: { instagramUsername: "padaria.flor" } })).toBe(0);
    expect(await db.rascunhoCadastro.findUnique({ where: { usuarioId: usuario.id } })).not.toBeNull();
  });

  it("o dono cadastra o próprio negócio e já sai com o código por DM pedido", async () => {
    const usuario = await semEmailConfirmado();
    const dados = formulario("padaria.flor");
    dados.set("souDono", "sim");
    dados.set("whatsapp", "(81) 99999-0000");

    const resultado = await indicar("padaria.flor", dados);

    expect(resultado).toMatchObject({ publicada: true, destino: "/empresas/padaria.flor/reivindicar?aviso=codigo_pedido#codigo" });
    const empresa = await db.empresa.findUniqueOrThrow({ where: { instagramUsername: "padaria.flor" } });
    expect(empresa).toMatchObject({ status: "indicada", whatsapp: "5581999990000" });
    expect(await db.reivindicacao.count({ where: { empresaId: empresa.id, usuarioId: usuario.id, metodo: "codigo_dm", status: "pendente" } })).toBe(1);
    // Cadastrar não faz ninguém virar dono: isso só vem com o código certo.
    expect(await db.empresaMembro.count({ where: { empresaId: empresa.id } })).toBe(0);
  });
});
