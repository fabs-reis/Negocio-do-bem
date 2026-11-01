import "server-only";
import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, readdir, realpath, stat, unlink, writeFile, type FileHandle } from "node:fs/promises";
import path from "node:path";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { descartarFotos, objetoDaFoto, type ResultadoDescarte } from "@/lib/ciclo-fotos";
import { db } from "@/lib/db";
import { TAMANHO_MAXIMO_FOTO, type TipoDeFoto } from "@/lib/fotos";
import { identidadeDaFoto } from "@/lib/fotos-historias";

// Em produção, UPLOADS é um binding R2 e NEXT_PUBLIC_R2_PUBLIC_URL é o domínio
// público conectado ao bucket. Em desenvolvimento, as fotos ficam no disco.
const PASTA_LOCAL = path.join(process.cwd(), "public", "enviados");

export const usaArmazenamentoCloudflare = () => Boolean(process.env.NEXT_PUBLIC_R2_PUBLIC_URL);

const configuracaoRemota = () => usaArmazenamentoCloudflare() || Boolean(process.env.FOTOS_R2_BUCKET) || ["production", "preview"].includes(process.env.DEPLOY_ENV ?? "");

type BucketDeUploads = {
  put(chave: string, conteudo: Blob, opcoes: { httpMetadata: { contentType: string } }): Promise<unknown>;
  delete(chave: string): Promise<void>;
};

function bucketDeUploads(): BucketDeUploads | undefined {
  return (getCloudflareContext().env as unknown as { UPLOADS?: BucketDeUploads }).UPLOADS;
}

/** Diz onde o comando de limpeza vai ler as fotos, para quem o roda saber o que o inventário cobre. */
export function descreverArmazenamento(): string {
  if (configuracaoRemota()) return "inventário R2 historias/";
  return "pasta local public/enviados/historias";
}

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
  if (usaArmazenamentoCloudflare()) {
    const bucket = bucketDeUploads();
    if (!bucket) throw new Error("O bucket R2 UPLOADS não está conectado a este Worker.");
    // O File vai inteiro: o R2 só aceita stream de tamanho conhecido.
    await bucket.put(nome, foto.arquivo, { httpMetadata: { contentType: foto.tipo } });
    return `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL!.replace(/\/$/, "")}/${nome}`;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Configure NEXT_PUBLIC_R2_PUBLIC_URL e o binding R2 UPLOADS para guardar fotos em produção.");
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
  const diretorio = path.join(PASTA_LOCAL, pasta);
  if (!await pastaLocalSegura(pasta)) return objetos;
  for (const arquivo of await readdir(diretorio, { withFileTypes: true })) {
    if (!arquivo.isFile()) continue;
    const url = identidadeDaFoto(`/enviados/${pasta}/${arquivo.name}`);
    if (url) objetos.set(url, path.join(diretorio, arquivo.name));
  }
  return objetos;
}

async function abrirPastaParaExclusao(): Promise<FileHandle> {
  if (process.platform !== "linux") throw new Error("A exclusão local exige Linux com /proc/self/fd.");
  const esperado = await lstat(path.join(PASTA_LOCAL, "historias"));
  if (!esperado.isDirectory()) throw new Error("A pasta da foto não é segura para exclusão.");
  const opcoes = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW;
  let pasta = await open(".", opcoes);
  try {
    // Each component opens through its parent descriptor without following symbolic links.
    for (const nome of ["public", "enviados", "historias"]) {
      const anterior = pasta;
      pasta = await open(`/proc/self/fd/${anterior.fd}/${nome}`, opcoes);
      await anterior.close();
    }
    const identidade = await pasta.stat();
    const viaProc = await stat(`/proc/self/fd/${pasta.fd}`);
    if (identidade.dev !== esperado.dev || identidade.ino !== esperado.ino || viaProc.dev !== identidade.dev || viaProc.ino !== identidade.ino) {
      throw new Error("A identidade da pasta mudou antes da exclusão.");
    }
    return pasta;
  } catch (erro) {
    await pasta.close();
    throw erro;
  }
}

async function excluirObjeto(url: string, objetos: Map<string, string>): Promise<void> {
  const chave = objetoDaFoto(url).chave;
  if (!objetos.has(url) || !/^historias\/[a-f0-9]{24}\.(jpg|png|webp)$/.test(chave)) {
    throw new Error("A foto não pertence ao inventário deste armazenamento.");
  }
  const pasta = await abrirPastaParaExclusao();
  // A renamed parent cannot redirect this path to a different directory.
  const destino = `/proc/self/fd/${pasta.fd}/${path.basename(chave)}`;
  try {
    try {
      if (!(await lstat(destino)).isFile()) throw new Error("O destino da foto não é um arquivo regular.");
      await unlink(destino);
    } catch (erro) {
      if (!(typeof erro === "object" && erro !== null && "code" in erro && erro.code === "ENOENT")) throw erro;
    }
    const atual = await abrirPastaParaExclusao();
    try {
      const selecionada = await pasta.stat();
      const identidade = await atual.stat();
      if (identidade.dev !== selecionada.dev || identidade.ino !== selecionada.ino) {
        throw new Error("A identidade da pasta mudou antes da confirmação.");
      }
      try {
        await lstat(`/proc/self/fd/${atual.fd}/${path.basename(chave)}`);
      } catch (erro) {
        if (typeof erro === "object" && erro !== null && "code" in erro && erro.code === "ENOENT") return;
        throw erro;
      }
      throw new Error("O armazenamento não confirmou a ausência da foto.");
    } finally {
      await atual.close();
    }
  } finally {
    await pasta.close();
  }
}

/** Physical deletion requires the explicit story cleanup command. */
export async function apagarFoto(_url: string | null): Promise<ResultadoDescarte["status"]> {
  return "bloqueada";
}

/** O diagnóstico é o padrão. Aplicar exige seleção explícita e domínio confirmado. */
export async function limparFotosHistorias(selecionadas: string[] = [], aplicar = false): Promise<ResultadoDescarte[]> {
  if (aplicar && selecionadas.length === 0) throw new Error("Escolha explicitamente as fotos que deseja descartar.");
  if (aplicar && process.env.FOTOS_DOMINIO_EXCLUSIVO !== "confirmado") {
    throw new Error("A exclusão está bloqueada: confirme todos os bancos e escritores que usam este armazenamento.");
  }
  const remoto = configuracaoRemota();
  if (aplicar && !remoto && process.platform !== "linux") throw new Error("A exclusão local exige Linux com /proc/self/fd. O diagnóstico continua disponível.");
  if (!remoto && process.env.NODE_ENV === "production") throw new Error("Configure o armazenamento R2 para a limpeza em produção.");
  const aposentadas = new Set<string>();
  for (const selecionada of selecionadas) {
    const url = identidadeDaFoto(selecionada);
    if (!url || !url.includes("/historias/") || (remoto && url.startsWith("/enviados/"))) continue;
    const objeto = objetoDaFoto(url);
    if (await db.fotoAposentada.findUnique({ where: { dominio_chave: objeto } })) aposentadas.add(url);
  }
  const inventario = remoto
    ? await (await import("@/lib/r2-administracao")).prepararInventarioHistoriasR2(aplicar, [...aposentadas])
    : await inventariarFotos("historias").then((objetos) => ({ objetos, excluir: (url: string) => excluirObjeto(url, objetos) }));
  const urls = selecionadas.length ? selecionadas.map(identidadeDaFoto) : [...inventario.objetos.keys()];
  for (const url of urls) {
    if (url && inventario.objetos.has(url)) continue;
    if (!url || !url.includes("/historias/") || (remoto && url.startsWith("/enviados/"))) throw new Error("A seleção contém foto fora do inventário de histórias.");
    const objeto = objetoDaFoto(url);
    if (!aposentadas.has(url)) throw new Error("A seleção contém foto fora do inventário de histórias.");
    // A previous request can remove an object before its response is lost.
    inventario.objetos.set(url, remoto ? objeto.chave : path.join(PASTA_LOCAL, objeto.chave));
  }
  return descartarFotos(urls as string[], inventario.excluir, aplicar);
}
