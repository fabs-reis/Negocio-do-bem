import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import { Client } from "pg";
import { expect, it } from "vitest";
import { URL_BANCO_TESTE } from "../banco-de-teste";

const raiz = path.resolve(import.meta.dirname, "../..");
const node = process.execPath;
const prisma = path.join(raiz, "node_modules/prisma/build/index.js");
const next = path.join(raiz, "node_modules/next/dist/bin/next");

function esquemaDoDeployment(id: string) {
  return `preview_${createHash("sha256").update(id).digest("hex").slice(0, 55)}`;
}

function ambiente(id: string, pasta: string): NodeJS.ProcessEnv {
  return {
    PATH: "/usr/bin:/bin",
    HOME: pasta,
    TMPDIR: pasta,
    NODE_ENV: "test",
    NEXT_TELEMETRY_DISABLED: "1",
    CHECKPOINT_DISABLE: "1",
    DATABASE_URL: URL_BANCO_TESTE,
    TEST_DATABASE_URL: URL_BANCO_TESTE,
    VERCEL: "1",
    VERCEL_ENV: "preview",
    VERCEL_DEPLOYMENT_ID: id,
  };
}

function executar(args: string[], env: NodeJS.ProcessEnv, capturar = false): string {
  const resultado = spawnSync(node, args, {
    cwd: raiz,
    env,
    encoding: "utf8",
    stdio: capturar ? ["ignore", "pipe", "ignore"] : "ignore",
  });
  expect(resultado.status, "O processo da prova precisa terminar com sucesso.").toBe(0);
  return resultado.stdout ?? "";
}

function cliente(comando: string, id: string, env: NodeJS.ProcessEnv) {
  return executar(
    ["--conditions=react-server", "--import", "tsx", "tests/apoio/cliente-preview.ts", comando, id],
    env,
    ["consultar", "consultar-bruto", "tabela-ausente", "esquema-sql", "migracoes"].includes(comando),
  );
}

function citarIdentificador(nome: string) {
  return `"${nome.replaceAll('"', '""')}"`;
}

async function portaLivre() {
  const servidor = createServer();
  servidor.listen(0, "127.0.0.1");
  await once(servidor, "listening");
  const endereco = servidor.address();
  if (!endereco || typeof endereco === "string") throw new Error("Não foi possível reservar a porta local.");
  const porta = endereco.port;
  await new Promise<void>((resolve, reject) => servidor.close((erro) => (erro ? reject(erro) : resolve())));
  return porta;
}

async function abrirServidor(env: NodeJS.ProcessEnv) {
  executar([next, "build"], { ...env, NODE_ENV: "production" });
  const porta = await portaLivre();
  const processo = spawn(node, [next, "start", "--hostname", "127.0.0.1", "--port", String(porta)], {
    cwd: raiz,
    env: { ...env, NODE_ENV: "production" },
    stdio: "ignore",
  });
  const url = `http://127.0.0.1:${porta}/explorar`;
  for (let tentativa = 0; tentativa < 300; tentativa++) {
    if (processo.exitCode !== null) throw new Error("O servidor da prova encerrou antes de responder.");
    try {
      const resposta = await fetch(url);
      if (resposta.ok) return { processo, url };
    } catch {
      // A conexão só fica disponível depois que o Next termina de iniciar.
    }
    await setTimeout(100);
  }
  processo.kill("SIGTERM");
  await once(processo, "exit");
  throw new Error("O servidor local não ficou disponível.");
}

it("isola migrações, seed e clientes de deployments de preview", async () => {
  const pasta = mkdtempSync(path.join(tmpdir(), "preview-isolado-"));
  const prefixo = randomUUID().replaceAll("-", "");
  const ids = [`dpl_${prefixo}a`, `dpl_${prefixo}b`, `dpl_${prefixo}h`];
  const esquemas = ids.map(esquemaDoDeployment);
  const esquemaDev = `dev_${prefixo}`;
  const esquemaComAspas = `${esquemaDev}\"local`;
  const conexao = new Client({ connectionString: URL_BANCO_TESTE });
  let servidor: ChildProcess | undefined;
  await conexao.connect();

  async function retrato(esquema: string) {
    const colunas = await conexao.query(
      "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = $1 ORDER BY table_name, ordinal_position",
      [esquema],
    );
    const migracoes = await conexao.query(`SELECT migration_name, checksum FROM "${esquema}"."_prisma_migrations" ORDER BY migration_name`);
    const usuarios = await conexao.query(`SELECT id, nome, email, papel FROM "${esquema}"."Usuario" ORDER BY id`);
    return { colunas: colunas.rows, migracoes: migracoes.rows, usuarios: usuarios.rows };
  }

  try {
    // Uma execução interrompida não pode deixar arquivos soltos dentro do repositório.
    expect(path.relative(raiz, pasta).startsWith(".."), "A pasta temporária precisa ficar fora do repositório.").toBe(true);
    const legado = await retrato("public");
    for (const [indice, id] of ids.entries()) {
      const env = ambiente(id, pasta);
      executar([prisma, "migrate", "deploy"], env);
      const criado = await conexao.query("SELECT 1 FROM information_schema.schemata WHERE schema_name = $1", [esquemas[indice]]);
      expect(criado.rowCount, "Cada preview precisa migrar um esquema próprio, sem reutilizar public.").toBe(1);
      executar(["--import", "tsx", "prisma/seed.ts"], env);
      cliente("criar", id, env);
      expect(JSON.parse(cliente("consultar-bruto", id, env)), "SQL bruto e ORM precisam usar o mesmo esquema.").toEqual([
        { nome: id, papel: "membro" },
      ]);
      const antes = await retrato(esquemas[indice]);
      executar(["--import", "tsx", "prisma/seed.ts"], env);
      expect(await retrato(esquemas[indice])).toEqual(antes);
    }

    // O script administrativo de cidades altera só o esquema do deployment que o executa.
    for (const esquema of [esquemas[0], esquemas[1]]) {
      await conexao.query(
        `UPDATE ${citarIdentificador(esquema)}."Empresa" SET "cidade" = 'FLORIANOPOLIS', "uf" = 'SC' WHERE "instagramUsername" = 'padaria.florescer.exemplo'`,
      );
    }
    executar(["--import", "tsx", "scripts/corrigir-cidades.ts", "--aplicar"], ambiente(ids[0], pasta));
    const cidades = await Promise.all(
      [esquemas[0], esquemas[1]].map((esquema) =>
        conexao.query(`SELECT "cidade" FROM ${citarIdentificador(esquema)}."Empresa" WHERE "instagramUsername" = 'padaria.florescer.exemplo'`),
      ),
    );
    expect(cidades.map((c) => c.rows[0].cidade), "O SQL do script precisa corrigir só o esquema de A.").toEqual(["Florianópolis", "FLORIANOPOLIS"]);

    await conexao.query(`CREATE SCHEMA ${citarIdentificador(esquemaDev)}`);
    await conexao.query(`CREATE TABLE ${citarIdentificador(esquemaDev)}."Usuario" (LIKE public."Usuario" INCLUDING ALL)`);
    const urlDev = new URL(URL_BANCO_TESTE);
    urlDev.searchParams.set("schema", esquemaDev);
    const envDev = { ...ambiente(ids[1], pasta), VERCEL_ENV: "development", DATABASE_URL: urlDev.toString() };
    const nomeDev = `${prefixo}dev`;
    cliente("criar", nomeDev, envDev);
    expect(JSON.parse(cliente("consultar-bruto", nomeDev, envDev))).toEqual([{ nome: nomeDev, papel: "membro" }]);
    expect(JSON.parse(cliente("esquema-sql", nomeDev, envDev))).toEqual({ texto: citarIdentificador(esquemaDev), valores: [] });
    await conexao.query(`CREATE SCHEMA ${citarIdentificador(esquemaComAspas)}`);
    await conexao.query(`CREATE TABLE ${citarIdentificador(esquemaComAspas)}."Usuario" (LIKE public."Usuario" INCLUDING ALL)`);
    await conexao.query(
      `INSERT INTO ${citarIdentificador(esquemaComAspas)}."Usuario" ("id", "nome", "email", "senhaHash") VALUES ($1, $2, $3, $4)`,
      [nomeDev, nomeDev, `${nomeDev}@exemplo.test`, "fixture-sem-login"],
    );
    const urlComAspas = new URL(URL_BANCO_TESTE);
    urlComAspas.searchParams.set("schema", esquemaComAspas);
    const envComAspas = { ...envDev, DATABASE_URL: urlComAspas.toString() };
    expect(JSON.parse(cliente("consultar-bruto", nomeDev, envComAspas))).toEqual([{ nome: nomeDev, papel: "membro" }]);
    expect(JSON.parse(cliente("esquema-sql", nomeDev, envComAspas))).toEqual({ texto: citarIdentificador(esquemaComAspas), valores: [] });

    const envB = ambiente(ids[1], pasta);
    executar(["--import", "tsx", "scripts/moderacao.ts", "dar", `${ids[1]}@exemplo.test`], envB);
    expect(JSON.parse(cliente("consultar", ids[1], envB))).toEqual({ nome: ids[1], papel: "moderador" });
    const antesB = await retrato(esquemas[1]);
    const antesHomologacao = await retrato(esquemas[2]);

    let url: string | undefined;
    const nomePublico = `Negócio isolado ${prefixo}`;
    if (process.env.NDB_TESTAR_PREVIEW === "1") {
      cliente("marcar-negocio", nomePublico, envB);
      const iniciado = await abrirServidor(envB);
      servidor = iniciado.processo;
      url = iniciado.url;
      expect(await (await fetch(url)).text()).toContain(nomePublico);
    }

    const migracoes = path.join(pasta, "migrations");
    cpSync(path.join(raiz, "prisma/migrations"), migracoes, { recursive: true });
    const alteracao = path.join(migracoes, "20990101000000_renomear_fixture");
    mkdirSync(alteracao);
    writeFileSync(path.join(alteracao, "migration.sql"), 'ALTER TABLE "Usuario" RENAME COLUMN "nome" TO "nome_da_fixture";\nDROP TABLE "Sessao";\n');
    const configuracao = path.join(pasta, "prisma.config.ts");
    writeFileSync(configuracao, `import original from ${JSON.stringify(path.join(raiz, "prisma.config.ts"))};\nexport default { ...original, schema: ${JSON.stringify(path.join(raiz, "prisma/schema.prisma"))}, migrations: { ...original.migrations, path: ${JSON.stringify(migracoes)} } };\n`);
    executar([prisma, "migrate", "deploy", "--config", configuracao], ambiente(ids[0], pasta));

    const colunaNova = await conexao.query(
      "SELECT 1 FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'Usuario' AND column_name = 'nome_da_fixture'",
      [esquemas[0]],
    );
    expect(colunaNova.rowCount).toBe(1);
    expect(cliente("tabela-ausente", ids[0], ambiente(ids[0], pasta))).toBe("ausente");
    const migracoesA: string[] = JSON.parse(cliente("migracoes", ids[0], ambiente(ids[0], pasta)));
    const migracoesB: string[] = JSON.parse(cliente("migracoes", ids[1], envB));
    expect(migracoesA, "A tela do sistema precisa ler o histórico do esquema de A.").toContain("20990101000000_renomear_fixture");
    expect(migracoesB, "A tela do sistema não pode ler o histórico de A em B.").not.toContain("20990101000000_renomear_fixture");
    expect(await retrato(esquemas[1])).toEqual(antesB);
    expect(await retrato(esquemas[2])).toEqual(antesHomologacao);
    expect(await retrato("public")).toEqual(legado);
    expect(JSON.parse(cliente("consultar", ids[1], envB))).toEqual({ nome: ids[1], papel: "moderador" });
    expect(JSON.parse(cliente("consultar-bruto", ids[1], envB))).toEqual([{ nome: ids[1], papel: "moderador" }]);
    if (url) expect(await (await fetch(url)).text()).toContain(nomePublico);
  } finally {
    if (servidor && servidor.exitCode === null) {
      servidor.kill("SIGTERM");
      await once(servidor, "exit");
    }
    for (const esquema of [...esquemas, esquemaDev, esquemaComAspas]) await conexao.query(`DROP SCHEMA IF EXISTS ${citarIdentificador(esquema)} CASCADE`);
    await conexao.end();
    rmSync(pasta, { recursive: true });
  }
}, 120_000);
