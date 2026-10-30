import { execFile } from "node:child_process";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { limparSessoesVencidas } from "@/lib/limpeza-sessoes";
import { URL_BANCO_TESTE } from "../banco-de-teste";

const vencimento = new Date("2000-01-01T00:00:00.000Z");
const futura = new Date("2100-01-01T00:00:00.000Z");
let usuarioId: string;

async function limparBanco() {
  await db.$executeRawUnsafe(
    'TRUNCATE "RegistroAuditoria", "Depoimento", "Reivindicacao", "EmpresaMembro", "EmpresaCausa", "Empresa", "Sessao", "LinkEmail", "TentativaAcesso", "Usuario" CASCADE',
  );
}

async function retratoDosOutrosDados() {
  return Promise.all([
    db.usuario.findMany(), db.linkEmail.findMany(), db.tentativaAcesso.findMany(),
    db.empresa.findMany(), db.empresaCausa.findMany(), db.empresaMembro.findMany(),
    db.reivindicacao.findMany(), db.depoimento.findMany(), db.registroAuditoria.findMany(),
  ]);
}

async function cliComBanco(conexao: string, ...argumentos: string[]) {
  return new Promise<{ codigo: number; stdout: string; stderr: string }>((resolve) => {
    execFile("npm", ["run", "--silent", "sessoes:limpar", "--", ...argumentos], {
      env: { ...process.env, DATABASE_URL: conexao },
    }, (erro, stdout, stderr) => {
      resolve({ codigo: typeof erro?.code === "number" ? erro.code : erro ? 1 : 0, stdout, stderr });
    });
  });
}

async function cli(...argumentos: string[]) {
  return cliComBanco(URL_BANCO_TESTE, ...argumentos);
}

beforeEach(async () => {
  await limparBanco();
  const usuario = await db.usuario.create({
    data: { nome: "Pessoa de teste", email: "limpeza@example.invalid", senhaHash: "hash-sintetico" },
  });
  usuarioId = usuario.id;
  const empresa = await db.empresa.create({
    data: { instagramUsername: "limpeza.teste", nome: "Negócio de teste", resumo: "Fixture", categoria: "Serviços", cidade: "Recife", uf: "PE" },
  });
  await db.empresaMembro.create({ data: { empresaId: empresa.id, usuarioId } });
  await db.empresaCausa.create({ data: { empresaId: empresa.id, causa: "sustentavel" } });
  await db.linkEmail.create({ data: { id: "link-sintetico-vencido", usuarioId, finalidade: "entrar", email: usuario.email, destino: "/", expiraEm: vencimento } });
  await db.tentativaAcesso.create({ data: { chave: "tentativa-sintetica", contagem: 1, janelaIniciadaEm: vencimento } });
  await db.reivindicacao.create({ data: { empresaId: empresa.id, usuarioId, metodo: "documento", expiraEm: vencimento } });
  await db.depoimento.create({ data: { empresaId: empresa.id, autorId: usuarioId, texto: "Depoimento sintético", status: "removido" } });
  await db.registroAuditoria.create({ data: { usuarioId, acao: "fixture", alvoTipo: "empresa", alvoId: empresa.id } });
  await db.sessao.createMany({ data: [
    { id: "01".repeat(32), usuarioId, expiraEm: vencimento },
    { id: "02".repeat(32), usuarioId, expiraEm: vencimento },
    { id: "ff".repeat(32), usuarioId, expiraEm: futura },
  ] });
});

afterAll(async () => {
  await limparBanco();
  await db.$disconnect();
});

describe("CLI de limpeza de sessões", () => {
  it("diagnostica pela CLI real sem mudar nenhuma tabela", async () => {
    const antes = await retratoDosOutrosDados();
    const sessoes = await db.sessao.findMany({ orderBy: { id: "asc" } });
    const resultado = await cli();
    expect(resultado.codigo).toBe(0);
    expect(resultado.stderr).toBe("");
    expect(resultado.stdout).toContain("Modo: diagnóstico");
    expect(resultado.stdout).toContain("Limite do lote: 100.");
    expect(resultado.stdout).toContain("Sessões vencidas: 2.");
    expect(resultado.stdout).toContain("Nada foi gravado.");
    expect(await db.sessao.findMany({ orderBy: { id: "asc" } })).toEqual(sessoes);
    expect(await retratoDosOutrosDados()).toEqual(antes);
  }, 20_000);

  it("aplica um lote pela CLI, preserva os outros dados e pode ser repetida", async () => {
    const antes = await retratoDosOutrosDados();
    const valida = await db.sessao.findUniqueOrThrow({ where: { id: "ff".repeat(32) } });
    const primeira = await cli("--aplicar", "--lote", "1");
    expect(primeira.codigo).toBe(0);
    expect(primeira.stderr).toBe("");
    expect(primeira.stdout).toContain("Sessões selecionadas: 1.");
    expect(primeira.stdout).toContain("Sessões removidas: 1.");
    expect(await db.sessao.findMany({ orderBy: { id: "asc" } })).toEqual([
      expect.objectContaining({ id: "02".repeat(32) }), valida,
    ]);
    const segunda = await cli("--aplicar", "--lote", "1");
    expect(segunda.stdout).toContain("Sessões removidas: 1.");
    const repetida = await cli("--aplicar", "--lote", "1");
    expect(repetida.stdout).toContain("Sessões removidas: 0.");
    expect(await db.sessao.findMany()).toEqual([valida]);
    expect(segunda.codigo).toBe(0);
    expect(repetida.codigo).toBe(0);
    expect(await retratoDosOutrosDados()).toEqual(antes);
    for (const resultado of [primeira, segunda, repetida]) {
      expect(resultado.stdout + resultado.stderr).not.toContain(usuarioId);
      expect(resultado.stdout + resultado.stderr).not.toContain("limpeza@example.invalid");
      expect(resultado.stdout + resultado.stderr).not.toContain("01".repeat(32));
      expect(resultado.stdout + resultado.stderr).not.toContain("changeme");
    }
  }, 20_000);

  it.each([["--lote", "0"], ["--aplicar", "--aplicar"], ["--lote"], ["--desconhecida"]])(
    "valida %j antes de tentar abrir uma conexão",
    async (...argumentos) => {
      const resultado = await cliComBanco("url-invalida", ...argumentos);
      expect(resultado.codigo).toBe(1);
      expect(resultado.stderr).toContain("Uso: npm run sessoes:limpar");
      expect(resultado.stderr).not.toContain("DATABASE_URL");
      expect(resultado.stdout).toBe("");
      expect(await db.sessao.count()).toBe(3);
    },
    20_000,
  );

  it("não vaza a conexão inválida nem presume sucesso", async () => {
    const resultado = await cliComBanco("postgresql://fixture:changeme@localhost:porta-invalida/negocio_do_bem_teste", "--aplicar");
    expect(resultado.codigo).toBe(1);
    expect(resultado.stderr).toContain("DATABASE_URL inválida.");
    expect(resultado.stdout).toBe("");
    expect(resultado.stderr).not.toContain("changeme");
    expect(resultado.stderr).not.toContain("postgresql://");
    expect(await db.sessao.count()).toBe(3);
  }, 20_000);

  it("informa falha de conexão sem imprimir detalhes do driver", async () => {
    const url = new URL(URL_BANCO_TESTE);
    url.pathname = "/limpeza_inexistente_test";
    const resultado = await cliComBanco(url.toString(), "--aplicar");
    expect(resultado.codigo).toBe(1);
    expect(resultado.stderr).toContain("Falha ao consultar o banco. Nenhuma exclusão foi solicitada.");
    expect(resultado.stdout).toBe("");
    expect(resultado.stderr).not.toContain("changeme");
    expect(resultado.stderr).not.toContain("postgresql://");
    expect(await db.sessao.count()).toBe(3);
  }, 20_000);

  it("falha na leitura sem solicitar exclusão nem anunciar sucesso", async () => {
    await db.$executeRawUnsafe('ALTER TABLE "Sessao" RENAME TO "SessaoIndisponivel"');
    try {
      const resultado = await cli("--aplicar");
      expect(resultado.codigo).toBe(1);
      expect(resultado.stderr).toContain("Falha ao consultar as sessões. Nenhuma exclusão foi solicitada.");
      expect(resultado.stdout).toBe("");
      expect(resultado.stderr).not.toContain("postgresql://");
    } finally {
      await db.$executeRawUnsafe('ALTER TABLE "SessaoIndisponivel" RENAME TO "Sessao"');
    }
    expect(await db.sessao.count()).toBe(3);
  }, 20_000);

  it("não anuncia exclusão confirmada quando o DELETE é recusado", async () => {
    await db.$executeRawUnsafe(`CREATE FUNCTION fixture_recusar_limpeza() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'falha sintética'; END $$`);
    await db.$executeRawUnsafe('CREATE TRIGGER fixture_recusar_limpeza BEFORE DELETE ON "Sessao" FOR EACH STATEMENT EXECUTE FUNCTION fixture_recusar_limpeza()');
    try {
      const resultado = await cli("--aplicar");
      expect(resultado.codigo).toBe(1);
      expect(resultado.stderr).toContain("O resultado é indeterminado.");
      expect(resultado.stderr).toContain("Faça novo diagnóstico antes de repetir.");
      expect(resultado.stdout).toBe("");
      expect(resultado.stderr).not.toContain("falha sintética");
      expect(await db.sessao.count()).toBe(3);
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER fixture_recusar_limpeza ON "Sessao"');
      await db.$executeRawUnsafe('DROP FUNCTION fixture_recusar_limpeza()');
    }
  }, 20_000);

  it("encerra a conexão da CLI antes de retornar", async () => {
    const url = new URL(URL_BANCO_TESTE);
    url.searchParams.set("application_name", "fixture_limpeza_cli");
    const resultado = await cliComBanco(url.toString());
    expect(resultado.codigo).toBe(0);
    const [atividade] = await db.$queryRaw<{ total: bigint }[]>`SELECT count(*) AS total FROM pg_stat_activity WHERE application_name = 'fixture_limpeza_cli'`;
    expect(Number(atividade.total)).toBe(0);
  }, 20_000);
});

describe("limpeza no PostgreSQL", () => {
  const corte = new Date("2020-01-01T00:00:00.000Z");

  async function substituirSessoes(expiracoes: Date[]) {
    await db.sessao.deleteMany();
    await db.sessao.createMany({ data: expiracoes.map((expiraEm, i) => ({
      id: i.toString(16).padStart(64, "0"), usuarioId, expiraEm,
    })) });
  }

  it("inclui o vencimento exato e preserva a sessão um milissegundo depois", async () => {
    await substituirSessoes([new Date(corte.getTime() - 1), corte, new Date(corte.getTime() + 1)]);
    const valida = await db.sessao.findUniqueOrThrow({ where: { id: "2".padStart(64, "0") } });
    const outros = await retratoDosOutrosDados();
    const resultado = await limparSessoesVencidas(db, { aplicar: true, lote: 100 }, corte);
    expect(resultado).toMatchObject({ vencidas: 2, selecionadas: 2, removidas: 2, referencia: corte });
    expect(await db.sessao.findMany()).toEqual([valida]);
    expect(await retratoDosOutrosDados()).toEqual(outros);
    expect(await limparSessoesVencidas(db, { aplicar: true, lote: 100 }, corte)).toMatchObject({ vencidas: 0, selecionadas: 0, removidas: 0 });
  });

  it.each([1, 100, 1000])("limita a seleção e o DELETE a %i sessões com desempate por ID", async (lote) => {
    await substituirSessoes(Array.from({ length: lote + 1 }, () => vencimento));
    const resultado = await limparSessoesVencidas(db, { aplicar: true, lote }, corte);
    expect(resultado).toMatchObject({ vencidas: lote + 1, selecionadas: lote, removidas: lote });
    expect(await db.sessao.findMany()).toEqual([expect.objectContaining({ id: lote.toString(16).padStart(64, "0") })]);
  });

  it("preserva a sessão renovada entre a seleção e o DELETE real", async () => {
    let atualizou = false;
    const concorrente = db.$extends({ query: { sessao: { async findMany({ args, query }) {
      const selecionadas = await query(args);
      await db.sessao.update({ where: { id: "01".repeat(32) }, data: { expiraEm: futura } });
      atualizou = true;
      return selecionadas;
    } } } });
    const resultado = await limparSessoesVencidas(concorrente, { aplicar: true, lote: 100 }, corte);
    expect(atualizou).toBe(true);
    expect(resultado).toMatchObject({ selecionadas: 2, removidas: 1 });
    expect(await db.sessao.findMany({ orderBy: { id: "asc" } })).toEqual([
      expect.objectContaining({ id: "01".repeat(32), expiraEm: futura }),
      expect.objectContaining({ id: "ff".repeat(32), expiraEm: futura }),
    ]);
  });

  it("mantém o corte mesmo se a referência recebida avançar durante a consulta", async () => {
    const referencia = new Date(corte);
    await substituirSessoes([new Date(corte.getTime() - 1), new Date(corte.getTime() + 1)]);
    const concorrente = db.$extends({ query: { sessao: { async count({ args, query }) {
      const quantidade = await query(args);
      referencia.setTime(corte.getTime() + 86_400_000);
      return quantidade;
    } } } });
    const resultado = await limparSessoesVencidas(concorrente, { aplicar: true, lote: 100 }, referencia);
    expect(resultado).toMatchObject({ referencia: corte, vencidas: 1, selecionadas: 1, removidas: 1 });
    expect(await db.sessao.findMany()).toEqual([expect.objectContaining({ id: "1".padStart(64, "0"), expiraEm: new Date(corte.getTime() + 1) })]);
  });

  it("não repete o DELETE quando a confirmação se perde depois da escrita real", async () => {
    let chamadas = 0;
    const semConfirmacao = db.$extends({ query: { sessao: { async deleteMany({ args, query }) {
      chamadas++;
      await query(args);
      throw new Error("detalhe privado da confirmação perdida");
    } } } });
    await expect(limparSessoesVencidas(semConfirmacao, { aplicar: true, lote: 100 }, corte)).rejects.toThrow("O resultado é indeterminado.");
    expect(chamadas).toBe(1);
    expect(await db.sessao.findMany()).toEqual([expect.objectContaining({ id: "ff".repeat(32) })]);
  });
});
