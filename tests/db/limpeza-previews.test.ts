import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configuracaoDoBanco } from "@/lib/banco";
import { URL_BANCO_TESTE } from "../banco-de-teste";

// A receita de limpeza dos esquemas de preview, em docs/como-foi-feito.md, apaga dados.
// Estes testes rodam o SQL da própria documentação e provam que a idade só lista candidatos:
// um esquema de deployment ainda ativo, o `public` e um nome fora do padrão nunca são apagados.

const DOC = path.resolve(import.meta.dirname, "../../docs/como-foi-feito.md");
const URL_LOCAL = Object.assign(new URL(URL_BANCO_TESTE), { search: "" }).toString();
const VIVOS_NO_DOC = "ARRAY['dpl_ID_ATIVO_1', 'dpl_ID_ATIVO_2']";
const ALVO_NO_DOC = "preview_ESQUEMA_A_APAGAR";

function bloco(marca: string) {
  // Os blocos ficam dentro de uma lista numerada, com recuo. O SQL não depende do recuo.
  const blocos = [...readFileSync(DOC, "utf8").matchAll(/^ *```sql\n([\s\S]*?)^ *```/gm)].map((achado) =>
    achado[1].replace(/^ +/gm, ""),
  );
  const achado = blocos.find((sql) => sql.trimStart().startsWith(`-- ${marca}`));
  if (!achado) throw new Error(`A documentação precisa ter um bloco SQL que começa com "-- ${marca}".`);
  return achado;
}

function lista(ids: string[]) {
  return `ARRAY[${ids.map((id) => `'${id}'`).join(", ")}]::text[]`;
}

function esquemaDe(id: string) {
  return configuracaoDoBanco("postgresql://x/y", "preview", id).esquema!;
}

const ATIVO = "dpl_AtivoDaHomologacao1";
const ANTIGO = "dpl_AntigoSemUso2";
const RECENTE = "dpl_RecenteSemUso3";

let cliente: Client;
let avisos: string[];

async function criar(id: string, diasAtras: number | null) {
  const esquema = esquemaDe(id);
  await cliente.query(`CREATE SCHEMA "${esquema}"`);
  await cliente.query(`CREATE TABLE "${esquema}"."Empresa" (id int)`);
  if (diasAtras !== null) {
    await cliente.query(`CREATE TABLE "${esquema}"._prisma_migrations (started_at timestamptz)`);
    await cliente.query(`INSERT INTO "${esquema}"._prisma_migrations VALUES (now() - make_interval(days => $1))`, [diasAtras]);
  }
  return esquema;
}

async function existe(esquema: string) {
  const { rowCount } = await cliente.query("SELECT 1 FROM pg_namespace WHERE nspname = $1", [esquema]);
  return rowCount === 1;
}

async function limpar() {
  const { rows } = await cliente.query("SELECT nspname FROM pg_namespace WHERE nspname LIKE 'preview\\_%'");
  for (const { nspname } of rows) await cliente.query(`DROP SCHEMA "${nspname}" CASCADE`);
}

beforeEach(async () => {
  cliente = new Client({ connectionString: URL_LOCAL });
  await cliente.connect();
  avisos = [];
  cliente.on("notice", (aviso) => avisos.push(aviso.message ?? ""));
  await limpar();
});

afterEach(async () => {
  await limpar();
  await cliente.end();
});

async function apagar(alvo: string, vivos: string[]) {
  const sql = bloco("APAGAR").replace(VIVOS_NO_DOC, lista(vivos)).replace(ALVO_NO_DOC, alvo);
  return cliente.query(sql);
}

describe("receita de limpeza dos esquemas de preview", () => {
  it("usa na documentação a mesma fórmula de nome do código", async () => {
    const { rows } = await cliente.query(
      "SELECT 'preview_' || left(encode(sha256(convert_to($1, 'UTF8')), 'hex'), 55) AS nome",
      [ATIVO],
    );
    expect(rows[0].nome).toBe(esquemaDe(ATIVO));
    expect(bloco("APAGAR")).toContain("sha256(convert_to(");
  });

  it("lista como candidato só o esquema antigo que nenhum deployment ativo usa, sem apagar nada", async () => {
    const ativo = await criar(ATIVO, 90);
    const antigo = await criar(ANTIGO, 90);
    const recente = await criar(RECENTE, 2);

    await cliente.query(bloco("LISTAR").replace(VIVOS_NO_DOC, lista([ATIVO])));

    const texto = avisos.join("\n");
    expect(texto).toMatch(new RegExp(`candidato.*${antigo}`));
    expect(texto).not.toMatch(new RegExp(`candidato.*${ativo}`));
    expect(texto).not.toMatch(new RegExp(`candidato.*${recente}`));
    expect(texto).toContain(`em uso, mantido: ${ativo}`);
    for (const esquema of [ativo, antigo, recente]) expect(await existe(esquema)).toBe(true);
  });

  it("apaga o esquema indicado quando ele é antigo e nenhum deployment ativo o usa", async () => {
    const ativo = await criar(ATIVO, 90);
    const antigo = await criar(ANTIGO, 90);

    await apagar(antigo, [ATIVO]);

    expect(await existe(antigo)).toBe(false);
    expect(await existe(ativo)).toBe(true);
  });

  it("recusa apagar o esquema de um deployment ativo, mesmo muito antigo", async () => {
    const ativo = await criar(ATIVO, 400);
    await expect(apagar(ativo, [ATIVO])).rejects.toThrow(/em uso/);
    expect(await existe(ativo)).toBe(true);
  });

  it("recusa apagar sem a lista dos deployments ativos", async () => {
    const antigo = await criar(ANTIGO, 90);
    await expect(apagar(antigo, [])).rejects.toThrow(/lista/);
    expect(await existe(antigo)).toBe(true);
  });

  it("recusa apagar um esquema com menos de 30 dias", async () => {
    const recente = await criar(RECENTE, 2);
    await expect(apagar(recente, [ATIVO])).rejects.toThrow(/30 dias/);
    expect(await existe(recente)).toBe(true);
  });

  it("recusa apagar um esquema sem histórico de migrações", async () => {
    const semHistorico = await criar(ANTIGO, null);
    await expect(apagar(semHistorico, [ATIVO])).rejects.toThrow(/_prisma_migrations/);
    expect(await existe(semHistorico)).toBe(true);
  });

  it.each(["public", "pg_catalog", 'preview_x"; DROP SCHEMA public; --', "preview_abc"])("recusa o nome fora do padrão: %s", async (alvo) => {
    await expect(apagar(alvo, [ATIVO])).rejects.toThrow(/nome/);
    expect(await existe("public")).toBe(true);
  });

  it("não traz mais a exclusão em lote por idade nem admite que a homologação perca o esquema", () => {
    const doc = readFileSync(DOC, "utf8");
    expect(doc).not.toContain("a homologação pode ter perdido o esquema");
    expect(bloco("APAGAR")).not.toMatch(/\bFOR\b[\s\S]*\bLOOP\b/);
  });
});
