import "server-only";
import { randomBytes } from "node:crypto";
import { lstat, mkdir, readdir, realpath, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { descartarFotos, type ResultadoDescarte } from "@/lib/ciclo-fotos";
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

async function excluirObjeto(url: string, objetos: Map<string, string>): Promise<void> {
  const objeto = objetos.get(url);
  if (!objeto) throw new Error("A foto não pertence ao inventário deste armazenamento.");
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
  if (configuracaoRemota() || process.env.NODE_ENV === "production" || !url?.startsWith("/enviados/")) return "bloqueada";
  const identidade = identidadeDaFoto(url);
  if (!identidade || process.env.FOTOS_DOMINIO_EXCLUSIVO !== "confirmado") return "bloqueada";
  try {
    const pasta = identidade.includes("/historias/") ? "historias" : "perfis";
    const objetos = await inventariarFotos(pasta);
    if (!objetos.has(identidade)) return "bloqueada";
    const [resultado] = await descartarFotos([identidade], (foto) => excluirObjeto(foto, objetos), true);
    return resultado.status;
  } catch (erro) {
    console.error("Não foi possível apagar a foto", url, erro);
    return "falha";
  }
}

/** O diagnóstico é o padrão. Aplicar exige seleção explícita e domínio confirmado. */
export async function limparFotosHistorias(selecionadas: string[] = [], aplicar = false): Promise<ResultadoDescarte[]> {
  if (aplicar && selecionadas.length === 0) throw new Error("Escolha explicitamente as fotos que deseja descartar.");
  if (aplicar && process.env.FOTOS_DOMINIO_EXCLUSIVO !== "confirmado") {
    throw new Error("A exclusão está bloqueada: confirme todos os bancos e escritores que usam este armazenamento.");
  }
  const remoto = configuracaoRemota();
  if (!remoto && process.env.NODE_ENV === "production") throw new Error("Configure o armazenamento R2 para a limpeza em produção.");
  const inventario = remoto
    ? await (await import("@/lib/r2-administracao")).prepararInventarioHistoriasR2(aplicar)
    : await inventariarFotos("historias").then((objetos) => ({ objetos, excluir: (url: string) => excluirObjeto(url, objetos) }));
  const urls = selecionadas.length ? selecionadas.map(identidadeDaFoto) : [...inventario.objetos.keys()];
  if (urls.some((url) => !url || !inventario.objetos.has(url))) throw new Error("A seleção contém foto fora do inventário de histórias.");
  return descartarFotos(urls as string[], inventario.excluir, aplicar);
}
