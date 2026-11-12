import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { configuracaoDoBanco, identificadorSql } from "@/lib/banco";
import { ambienteDeDeploy } from "@/lib/ambiente";

export type { Prisma } from "@/generated/prisma/client";

const ambienteBanco = process.env.BANCO_PREVIEW_AMBIENTE === "preview" || ambienteDeDeploy() === "preview"
  ? "preview" : process.env.BANCO_PREVIEW_AMBIENTE;
// SQL bruto precisa de qualificação explícita: pools transacionais não garantem search_path.
export function esquemaSql() {
  return Prisma.raw(identificadorSql(configuracaoAtual().esquema));
}

// Em desenvolvimento o Next recarrega os módulos a cada mudança; guardar o
// cliente no globalThis evita abrir um pool de conexões novo a cada recarga.
const cache = globalThis as unknown as { prisma?: PrismaClient };

function criarCliente() {
  const conexao = configuracaoAtual();
  const adapter = new PrismaPg({ connectionString: conexao.url }, { schema: conexao.esquema });
  return new PrismaClient({ adapter });
}

// No Cloudflare Workers, uma conexão aberta numa requisição não pode ser usada
// em outra: a segunda trava ou falha com "Cannot perform I/O on behalf of a
// different request". Lá, cada requisição ganha o seu cliente. O OpenNext guarda
// o contexto da requisição neste símbolo; fora do Worker ele não existe.
const CONTEXTO_CLOUDFLARE = Symbol.for("__cloudflare-context__");
const clientesPorRequisicao = new WeakMap<object, PrismaClient>();

type ContextoCloudflare = { ctx?: object; env?: { HYPERDRIVE?: { connectionString: string } } };

function configuracaoAtual() {
  const contexto = (globalThis as unknown as Record<symbol, ContextoCloudflare | undefined>)[CONTEXTO_CLOUDFLARE];
  const provedor = process.env.BANCO_PREVIEW_PROVEDOR;
  if (ambienteBanco === "preview") {
    if ((contexto?.ctx || process.env.DEPLOY_ENV) && provedor !== "cloudflare") {
      throw new Error("O preview Cloudflare precisa de uma identidade Cloudflare compilada.");
    }
    if (!contexto?.ctx && !process.env.DEPLOY_ENV && process.env.VERCEL_ENV && provedor !== "vercel") {
      throw new Error("O preview Vercel precisa de uma identidade Vercel compilada.");
    }
  }
  const transporte = (contexto?.ctx && contexto.env?.HYPERDRIVE?.connectionString) || process.env.DATABASE_URL;
  return configuracaoDoBanco(transporte, ambienteBanco, process.env.BANCO_PREVIEW_ID, provedor);
}

function clienteDaRequisicao(): PrismaClient | undefined {
  const contexto = (globalThis as unknown as Record<symbol, ContextoCloudflare | undefined>)[CONTEXTO_CLOUDFLARE];
  if (!contexto?.ctx) return undefined;
  let cliente = clientesPorRequisicao.get(contexto.ctx);
  if (!cliente) {
    // Com o binding HYPERDRIVE, a conexão de cada requisição vai até o Hyperdrive,
    // que mantém as conexões com o banco abertas. Ele só existe na produção (os
    // previews não herdam bindings); nos previews vale a DATABASE_URL.
    cliente = criarCliente();
    clientesPorRequisicao.set(contexto.ctx, cliente);
  }
  return cliente;
}

let clienteUnico: PrismaClient | undefined = cache.prisma;

function cliente(): PrismaClient {
  const daRequisicao = clienteDaRequisicao();
  if (daRequisicao) return daRequisicao;
  if (!clienteUnico) {
    clienteUnico = criarCliente();
    if (process.env.NODE_ENV !== "production") cache.prisma = clienteUnico;
  }
  return clienteUnico;
}

// O que for definido no próprio db (como o vi.spyOn dos testes) vale antes do cliente.
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(proprio, propriedade) {
    if (Object.hasOwn(proprio, propriedade)) return Reflect.get(proprio, propriedade);
    const alvo = cliente();
    const valor = Reflect.get(alvo, propriedade, alvo);
    return typeof valor === "function" ? valor.bind(alvo) : valor;
  },
  has(proprio, propriedade) {
    return Object.hasOwn(proprio, propriedade) || propriedade in cliente();
  },
  getOwnPropertyDescriptor(proprio, propriedade) {
    if (Object.hasOwn(proprio, propriedade)) return Reflect.getOwnPropertyDescriptor(proprio, propriedade);
    if (!(propriedade in cliente())) return undefined;
    return { configurable: true, enumerable: true, writable: true, value: Reflect.get(db, propriedade) };
  },
});
