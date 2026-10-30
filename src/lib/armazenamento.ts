import "server-only";
import { randomBytes } from "node:crypto";
import { lstat, mkdir, readdir, realpath, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, list, put } from "@vercel/blob";
import { descartarFotos, type ResultadoDescarte } from "@/lib/ciclo-fotos";
import { TAMANHO_MAXIMO_FOTO, type TipoDeFoto } from "@/lib/fotos";
import { identidadeDaFoto } from "@/lib/fotos-historias";

// Com BLOB_STORE_ID ou BLOB_READ_WRITE_TOKEN, as fotos vão para o Vercel Blob.
// No Vercel, o @vercel/blob se autentica pelo OIDC do deploy com o BLOB_STORE_ID
// e só usa o token se não houver OIDC. Sem nenhum dos dois, em desenvolvimento,
// as fotos ficam em public/enviados, que o Next serve direto.
const PASTA_LOCAL = path.join(process.cwd(), "public", "enviados");

export const usaBlob = () => Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);

const EXTENSOES: Record<TipoDeFoto, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// Primeiros bytes de cada formato: o tipo informado pelo navegador não basta.
function tipoPelosBytes(inicio: Uint8Array): TipoDeFoto | null {
  const texto = (de: number, ate: number) => String.fromCharCode(...inicio.subarray(de, ate));
  if (inicio[0] === 0xff && inicio[1] === 0xd8 && inicio[2] === 0xff) return "image/jpeg";
  if (inicio[0] === 0x89 && texto(1, 4) === "PNG") return "image/png";
  if (texto(0, 4) === "RIFF" && texto(8, 12) === "WEBP") return "image/webp";
  return null;
}

export type FotoConferida = { arquivo: File; tipo: TipoDeFoto } | { erro: string };

/** Confere a foto que veio do formulário antes de guardar. */
export async function conferirFoto(valor: FormDataEntryValue | null): Promise<FotoConferida> {
  if (!(valor instanceof File) || valor.size === 0) return { erro: "Escolha uma foto." };
  if (valor.size > TAMANHO_MAXIMO_FOTO) return { erro: "A foto pode ter até 3 MB." };
  const tipo = tipoPelosBytes(new Uint8Array(await valor.slice(0, 12).arrayBuffer()));
  if (!tipo) return { erro: "Use uma foto JPG, PNG ou WebP." };
  return { arquivo: valor, tipo };
}

/** Guarda a foto com um nome aleatório e devolve o endereço público dela. */
export async function guardarFoto(foto: { arquivo: File; tipo: TipoDeFoto }, pasta: "perfis" | "historias"): Promise<string> {
  const nome = `${pasta}/${randomBytes(12).toString("hex")}.${EXTENSOES[foto.tipo]}`;
  if (usaBlob()) {
    const { url } = await put(nome, foto.arquivo, { access: "public", contentType: foto.tipo });
    return url;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Conecte um Vercel Blob (BLOB_STORE_ID ou BLOB_READ_WRITE_TOKEN) para guardar fotos em produção.");
  }
  const destino = path.join(PASTA_LOCAL, nome);
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, Buffer.from(await foto.arquivo.arrayBuffer()));
  return `/enviados/${nome}`;
}

async function pastaLocalSegura(pasta: "perfis" | "historias"): Promise<boolean> {
  const destino = path.join(PASTA_LOCAL, pasta);
  try {
    if (await realpath(destino) !== destino) return false;
    return (await lstat(destino)).isDirectory();
  } catch (erro) {
    if (typeof erro === "object" && erro !== null && "code" in erro && erro.code === "ENOENT") return false;
    throw erro;
  }
}

async function inventariarFotos(pasta: "perfis" | "historias"): Promise<Map<string, string>> {
  const objetos = new Map<string, string>();
  if (usaBlob()) {
    let cursor: string | undefined;
    const vistos = new Set<string>();
    do {
      const pagina = await list({ prefix: `${pasta}/`, ...(cursor ? { cursor } : {}) });
      for (const foto of pagina.blobs) {
        const identidade = identidadeDaFoto(foto.url);
        if (identidade && new URL(identidade).pathname === `/${foto.pathname}` && foto.pathname.startsWith(`${pasta}/`)) {
          objetos.set(identidade, foto.url);
        }
      }
      if (!pagina.hasMore) break;
      if (!pagina.cursor || vistos.has(pagina.cursor)) throw new Error("O inventário de fotos não terminou corretamente.");
      cursor = pagina.cursor;
      vistos.add(cursor);
    } while (cursor);
    return objetos;
  }
  const diretorio = path.join(PASTA_LOCAL, pasta);
  if (!await pastaLocalSegura(pasta)) return objetos;
  for (const arquivo of await readdir(diretorio, { withFileTypes: true })) {
    if (!arquivo.isFile()) continue;
    const url = identidadeDaFoto(`/enviados/${pasta}/${arquivo.name}`);
    if (url) objetos.set(url, path.join(diretorio, arquivo.name));
  }
  return objetos;
}

async function excluirObjeto(url: string, objetos: Map<string, string>): Promise<void> {
  const objeto = objetos.get(url);
  if (!objeto) throw new Error("A foto não pertence ao inventário deste armazenamento.");
  if (usaBlob()) {
    await del(objeto);
    return;
  }
  const pasta = url.includes("/historias/") ? "historias" : "perfis";
  if (!await pastaLocalSegura(pasta)) throw new Error("A pasta da foto não é segura para exclusão.");
  try {
    if (!(await lstat(objeto)).isFile()) throw new Error("O destino da foto não é um arquivo regular.");
    await unlink(objeto);
  } catch (erro) {
    if (typeof erro === "object" && erro !== null && "code" in erro && erro.code === "ENOENT") return;
    throw erro;
  }
}

/** Sem domínio exclusivo confirmado, preserva inclusive fotos de perfil antigas. */
export async function apagarFoto(url: string | null): Promise<ResultadoDescarte["status"]> {
  const identidade = url && identidadeDaFoto(url);
  if (!identidade || process.env.FOTOS_DOMINIO_EXCLUSIVO !== "confirmado") return "bloqueada";
  try {
    const pasta = identidade.includes("/historias/") ? "historias" : "perfis";
    const objetos = await inventariarFotos(pasta);
    if (!objetos.has(identidade)) return "bloqueada";
    const [resultado] = await descartarFotos([identidade], (foto) => excluirObjeto(foto, objetos), true);
    return resultado.status;
  } catch {
    return "falha";
  }
}

/** O diagnóstico é o padrão. Aplicar exige seleção explícita e domínio confirmado. */
export async function limparFotosHistorias(selecionadas: string[] = [], aplicar = false): Promise<ResultadoDescarte[]> {
  if (aplicar && selecionadas.length === 0) throw new Error("Escolha explicitamente as fotos que deseja descartar.");
  if (aplicar && process.env.FOTOS_DOMINIO_EXCLUSIVO !== "confirmado") {
    throw new Error("A exclusão está bloqueada: confirme todos os bancos e escritores que usam este armazenamento.");
  }
  const objetos = await inventariarFotos("historias");
  const urls = selecionadas.length ? selecionadas.map(identidadeDaFoto) : [...objetos.keys()];
  if (urls.some((url) => !url || !objetos.has(url))) throw new Error("A seleção contém foto fora do inventário de histórias.");
  return descartarFotos(urls as string[], (url) => excluirObjeto(url, objetos), aplicar);
}
