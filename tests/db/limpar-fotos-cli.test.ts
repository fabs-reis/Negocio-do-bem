import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { URL_BANCO_TESTE } from "../banco-de-teste";

const executar = promisify(execFile);

/** Roda o comando como o `npm run fotos:limpar`, só com o ambiente que o teste dá. */
async function rodar(argumentos: string[], ambiente: Record<string, string> = {}) {
  try {
    const { stdout, stderr } = await executar(
      process.execPath,
      [...(ambiente.R2_TESTE_API ? ["--import", "./tests/apoio/r2-cli/preload.mjs"] : []), "--conditions=react-server", "--import", "tsx", "scripts/limpar-fotos-historias.ts", ...argumentos],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", NODE_ENV: "test", DATABASE_URL: URL_BANCO_TESTE, ...ambiente },
      },
    );
    return { codigo: 0, stdout, stderr };
  } catch (erro) {
    const falha = erro as { code: number; stdout: string; stderr: string };
    return { codigo: falha.code, stdout: falha.stdout, stderr: falha.stderr };
  }
}

describe("comando fotos:limpar", () => {
  it("diz qual armazenamento e qual banco leu", async () => {
    const r = await rodar(["listar"]);

    expect(r.codigo).toBe(0);
    expect(r.stdout).toContain("Armazenamento lido: pasta local");
    expect(r.stdout).toContain("Banco lido:");
  }, 60_000);

  it("mostra o motivo do erro, não só uma frase genérica", async () => {
    const r = await rodar(["listar", "https://abc.public.blob.vercel-storage.com/historias/aaaaaaaaaaaaaaaaaaaaaaaa.jpg"]);

    expect(r.codigo).toBe(1);
    expect(r.stderr).toContain("A seleção contém foto fora do inventário de histórias.");
    expect(r.stdout).toContain("Armazenamento lido: pasta local");
  }, 60_000);

  it("mostra o motivo quando o banco não responde", async () => {
    const r = await rodar(["listar"], { DATABASE_URL: "postgresql://postgres@127.0.0.1:1/inexistente" });

    expect(r.codigo).toBe(1);
    expect(r.stderr).toMatch(/reach database server|ECONNREFUSED/i);
  }, 60_000);
});


const chave = "historias/aaaaaaaaaaaaaaaaaaaaaaaa.jpg";
const foto = `https://fotos.exemplo.com/${chave}`;
const requisicoes: { metodo: string; caminho: string; catalogo?: string }[] = [];
let recusar = false;
let confirmar = true;
let aliases = false;
let bancoDiferente = false;
let api: string;

function responder(req: IncomingMessage, res: ServerResponse) {
  const caminho = req.url ?? "";
  requisicoes.push({ metodo: req.method ?? "", caminho, catalogo: req.headers["cf-r2-data-catalog-check"] as string | undefined });
  const url = new URL(caminho, "http://localhost");
  const dbUrl = new URL(URL_BANCO_TESTE);
  let resultado: unknown;
  if (url.pathname.endsWith("/hyperdrive/configs/hyper-id")) resultado = { origin: { host: dbUrl.hostname, database: bancoDiferente ? "outro" : decodeURIComponent(dbUrl.pathname.slice(1)), user: decodeURIComponent(dbUrl.username), port: Number(dbUrl.port || 5432), scheme: "postgres" } };
  else if (url.pathname.endsWith("/domains/custom")) resultado = { domains: [{ domain: "fotos.exemplo.com", enabled: true }, ...(aliases ? [{ domain: "alias.exemplo.com", enabled: true }] : [])] };
  else if (url.pathname.endsWith("/domains/managed")) resultado = { domain: "outro.r2.dev", enabled: false };
  else if (url.pathname.endsWith("/objects")) {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ success: true, result: url.searchParams.has("cursor") ? [{ key: chave }] : [], result_info: url.searchParams.has("cursor") ? { is_truncated: false } : { is_truncated: true, cursor: "pagina" } }));
    return;
  } else if (url.pathname.endsWith(`/objects/${chave}`)) {
    res.statusCode = req.method === "DELETE" ? (recusar ? 409 : 200) : (confirmar ? 404 : 200);
    res.end();
    return;
  } else { res.statusCode = 500; res.end(); return; }
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ success: true, result: resultado }));
}

const servidor = createServer(responder);
beforeAll(async () => {
  await new Promise<void>((resolve) => servidor.listen(0, "127.0.0.1", resolve));
  const endereco = servidor.address();
  if (!endereco || typeof endereco === "string") throw new Error("Servidor de teste indisponível");
  api = `http://127.0.0.1:${endereco.port}`;
});
beforeEach(async () => {
  requisicoes.length = 0;
  recusar = false;
  confirmar = true;
  aliases = false;
  bancoDiferente = false;
  await db.$executeRawUnsafe(`TRUNCATE "RegistroAuditoria", "Depoimento", "Reivindicacao", "EmpresaMembro", "EmpresaCausa", "Empresa", "Sessao", "Usuario" CASCADE`);
});
afterAll(async () => { await db.$disconnect(); await new Promise<void>((resolve, reject) => servidor.close((erro) => erro ? reject(erro) : resolve())); });

function ambienteR2(cenario: Record<string, unknown> = {}) {
  return {
    R2_TESTE_API: api,
    R2_TESTE_CENARIO: JSON.stringify({ bucket: "fotos", origem: "https://fotos.exemplo.com", ...cenario }),
    CLOUDFLARE_ACCOUNT_ID: "conta", CLOUDFLARE_API_TOKEN: "token-sintetico",
    FOTOS_R2_BUCKET: "fotos", NEXT_PUBLIC_R2_PUBLIC_URL: "https://fotos.exemplo.com",
    DEPLOY_ENV: "production", FOTOS_DOMINIO_EXCLUSIVO: "confirmado",
  };
}

function mutacoes() { return requisicoes.filter((r) => r.metodo === "DELETE"); }
async function marcas() { return db.registroAuditoria.count({ where: { acao: "foto.descarte_iniciado" } }); }

describe("comando R2 com transporte isolado", () => {
  it("lista as páginas sem marcar ou excluir", async () => {
    const r = await rodar(["listar"], ambienteR2());
    expect(r.codigo).toBe(0);
    expect(r.stdout).toContain("inventário R2");
    expect(r.stdout).toContain(foto);
    expect(requisicoes.filter((r) => r.caminho.includes("/objects?")).length).toBe(2);
    expect(mutacoes()).toEqual([]);
    expect(await marcas()).toBe(0);
  });

  it("descarta somente a seleção após conferir a associação", async () => {
    const r = await rodar(["descartar", foto], ambienteR2());
    expect(r.codigo).toBe(0);
    expect(r.stdout).toContain("descartada");
    expect(await marcas()).toBe(1);
    expect(mutacoes()).toEqual([{ metodo: "DELETE", caminho: `/client/v4/accounts/conta/r2/buckets/fotos/objects/${chave}`, catalogo: "true" }]);
    expect(requisicoes.at(-1)?.metodo).toBe("GET");
  });

  it("preserva referências no banco", async () => {
    await db.empresa.create({ data: { instagramUsername: "r2.cli", nome: "Loja", resumo: "Resumo", categoria: "Serviços", cidade: "Recife", uf: "PE", historia: `![Foto](${foto})` } });
    const r = await rodar(["descartar", foto], ambienteR2());
    expect(r.codigo).toBe(0);
    expect(r.stdout).toContain("preservada");
    expect(mutacoes()).toEqual([]);
    expect(await marcas()).toBe(0);
  });

  it.each(["bucket", "origem", "banco", "identidade", "alias"])("recusa %s sem marcar ou excluir", async (caso) => {
    bancoDiferente = caso === "banco";
    aliases = caso === "alias";
    const cenario = caso === "bucket" ? { bucket: "outro" } : caso === "origem" ? { origem: "https://preview.exemplo.com" } : caso === "identidade" ? { semIdentidade: true } : {};
    const r = await rodar(["descartar", foto], ambienteR2(cenario));
    expect(r.codigo).toBe(1);
    expect(mutacoes()).toEqual([]);
    expect(await marcas()).toBe(0);
  });

  it.each(["recusa", "confirmacao"])("mantém a marca após falha de %s, sem repetir", async (caso) => {
    recusar = caso === "recusa";
    confirmar = caso !== "confirmacao";
    const r = await rodar(["descartar", foto], ambienteR2());
    expect(r.codigo).toBe(1);
    expect(await marcas()).toBe(1);
    expect(mutacoes()).toHaveLength(1);
    expect(mutacoes()[0].catalogo).toBe("true");
  });
});
