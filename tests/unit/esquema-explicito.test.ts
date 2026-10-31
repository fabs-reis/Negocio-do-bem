import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Nos previews, o esquema do deployment só vale se todo acesso ao banco o seleciona.
// Um `$queryRaw` sem `esquemaSql` ou um `PrismaPg` sem `schema` leria o esquema `public`,
// que ainda tem todas as tabelas e é dividido entre os previews.

const raiz = path.resolve(import.meta.dirname, "../..");
const PASTAS = ["src", "scripts", "prisma"];
const IGNORADAS = new Set(["node_modules", "generated", "migrations"]);

function arquivos(pasta: string): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((item) => {
    if (IGNORADAS.has(item.name)) return [];
    const caminho = path.join(pasta, item.name);
    if (item.isDirectory()) return arquivos(caminho);
    return /\.(ts|tsx|mts)$/.test(item.name) ? [caminho] : [];
  });
}

/** Devolve o trecho que vai do início até o fim do template (crase) ou da chamada (parênteses). */
function trecho(texto: string, inicio: number): string | undefined {
  const abertura = texto[inicio];
  if (abertura === "`") {
    const fim = texto.indexOf("`", inicio + 1);
    return fim === -1 ? undefined : texto.slice(inicio, fim + 1);
  }
  if (abertura !== "(") return undefined;
  let profundidade = 0;
  for (let i = inicio; i < texto.length; i++) {
    if (texto[i] === "(") profundidade++;
    if (texto[i] === ")" && --profundidade === 0) return texto.slice(inicio, i + 1);
  }
  return undefined;
}

function verificarEsquemaExplicito(texto: string) {
  const problemas: string[] = [];
  let consultas = 0;
  let adaptadores = 0;

  for (const achado of texto.matchAll(/\$(queryRaw|executeRaw)(Unsafe)?(?:<[^>\n]*>)?(?=[`(])/g)) {
    consultas++;
    if (achado[2]) {
      problemas.push(`$${achado[1]}Unsafe não qualifica o esquema; use $${achado[1]} com \${esquemaSql}`);
      continue;
    }
    const corpo = trecho(texto, achado.index + achado[0].length);
    if (!corpo?.includes("esquemaSql")) {
      problemas.push(`$${achado[1]} sem esquemaSql: qualifique a tabela com \${esquemaSql}."Tabela"`);
    }
  }

  for (const achado of texto.matchAll(/new PrismaPg(?=\()/g)) {
    adaptadores++;
    const corpo = trecho(texto, achado.index + achado[0].length);
    if (!corpo || !/\bschema\s*:/.test(corpo)) {
      problemas.push("new PrismaPg sem { schema }: passe o esquema de banco.esquema ao adaptador");
    }
  }

  return { problemas, consultas, adaptadores };
}

describe("detector de acesso ao banco sem esquema explícito", () => {
  it("recusa SQL bruto que não usa esquemaSql", () => {
    expect(verificarEsquemaExplicito('db.$queryRaw`SELECT 1 FROM "Empresa"`').problemas).toHaveLength(1);
    expect(verificarEsquemaExplicito('db.$executeRaw`UPDATE "Empresa" SET "nome" = ${n}`').problemas).toHaveLength(1);
    expect(verificarEsquemaExplicito('db.$queryRaw<Linha[]>`SELECT 1 FROM "Empresa"`').problemas).toHaveLength(1);
    expect(verificarEsquemaExplicito('db.$queryRawUnsafe("SELECT 1")').problemas).toHaveLength(1);
    expect(verificarEsquemaExplicito('db.$executeRaw(Prisma.sql`UPDATE "Empresa" SET "x" = 1`)').problemas).toHaveLength(1);
  });

  it("aceita SQL bruto que qualifica a tabela com esquemaSql", () => {
    const bom = 'db.$queryRaw<Linha[]>`SELECT 1 FROM ${esquemaSql}."Empresa"`; tx.$executeRaw(Prisma.sql`UPDATE ${esquemaSql}."Empresa" SET "x" = 1`)';
    expect(verificarEsquemaExplicito(bom)).toMatchObject({ problemas: [], consultas: 2 });
  });

  it("recusa PrismaPg sem schema e aceita com schema", () => {
    expect(verificarEsquemaExplicito("new PrismaPg({ connectionString: url })").problemas).toHaveLength(1);
    expect(verificarEsquemaExplicito("new PrismaPg({ connectionString: url }, {})").problemas).toHaveLength(1);
    expect(verificarEsquemaExplicito("new PrismaPg({ connectionString: url }, { schema: banco.esquema })")).toMatchObject({
      problemas: [],
      adaptadores: 1,
    });
  });

  it("ignora a menção a $queryRaw em comentário", () => {
    expect(verificarEsquemaExplicito("// não use $queryRaw sem esquemaSql").consultas).toBe(0);
  });
});

describe("código do projeto", () => {
  const lidos = PASTAS.flatMap((pasta) => arquivos(path.join(raiz, pasta))).map((caminho) => ({
    arquivo: path.relative(raiz, caminho),
    ...verificarEsquemaExplicito(readFileSync(caminho, "utf8")),
  }));

  it("encontra os acessos que o teste precisa vigiar", () => {
    // Sem isso, mover o código para fora das pastas lidas deixaria o teste verde sem vigiar nada.
    expect(lidos.reduce((soma, l) => soma + l.consultas, 0)).toBeGreaterThanOrEqual(2);
    expect(lidos.reduce((soma, l) => soma + l.adaptadores, 0)).toBeGreaterThanOrEqual(4);
  });

  it("seleciona o esquema do deployment em todo SQL bruto e em todo PrismaPg", () => {
    const problemas = lidos.flatMap((l) => l.problemas.map((p) => `${l.arquivo}: ${p}`));
    expect(problemas).toEqual([]);
  });
});
