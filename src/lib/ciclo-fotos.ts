import "server-only";
import { registrarAuditoria } from "@/lib/auditoria";
import { db, type Prisma } from "@/lib/db";
import { fotosDaHistoria, identidadeDaFoto } from "@/lib/fotos-historias";

const ACAO_DESCARTE = "foto.descarte_iniciado";

export type ResultadoDescarte = {
  url: string;
  status: "candidata" | "preservada" | "descartada" | "bloqueada" | "falha";
};

export class ErroFotoDescartada extends Error {
  constructor() {
    super("Uma foto desta história já entrou em descarte. Envie a foto novamente antes de salvar.");
  }
}

async function bloquearFotos(tx: Prisma.TransactionClient) {
  // Salvamento e descarte usam a mesma trava, inclusive entre instâncias.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(7346019)`;
}

export async function validarFotosDaHistoria(tx: Prisma.TransactionClient, historia: string): Promise<void> {
  // Sem foto no texto, não há o que conferir: nem a trava nem o banco são necessários.
  const fotos = [...fotosDaHistoria(historia)];
  if (fotos.length === 0) return;
  await bloquearFotos(tx);
  const descartada = await tx.registroAuditoria.findFirst({
    where: { acao: ACAO_DESCARTE, alvoTipo: "foto", alvoId: { in: fotos } },
    select: { id: true },
  });
  if (descartada) throw new ErroFotoDescartada();
}

// O descarte lê e interpreta todas as histórias com a trava presa. Sem este limite, o padrão de 5 s
// do Prisma (que conta a espera pela trava) derrubaria a limpeza e os salvamentos que esperam por ela.
const LIMITE_DA_TRANSACAO = { maxWait: 10_000, timeout: 60_000 };

async function fotosEmUso(cliente: Pick<Prisma.TransactionClient, "empresa">): Promise<Set<string>> {
  const empresas = await cliente.empresa.findMany({ select: { historia: true, fotoUrl: true } });
  const usadas = new Set<string>();
  for (const empresa of empresas) {
    for (const foto of fotosDaHistoria(empresa.historia)) usadas.add(foto);
    const perfil = empresa.fotoUrl && identidadeDaFoto(empresa.fotoUrl);
    if (perfil) usadas.add(perfil);
  }
  return usadas;
}

/** O inventário deve pertencer ao armazenamento administrado por este processo. */
export async function descartarFotos(
  urls: string[],
  excluir: (url: string) => Promise<void>,
  aplicar = false,
): Promise<ResultadoDescarte[]> {
  const identidades = urls.map(identidadeDaFoto);
  if (identidades.some((url) => url === null)) throw new Error("O inventário contém uma foto com identidade ambígua.");
  const candidatas = [...new Set(identidades as string[])];
  // shortcut: um banco não conhece referências de outros bancos. Só habilitar após confirmar esse domínio.
  if (aplicar && process.env.FOTOS_DOMINIO_EXCLUSIVO !== "confirmado") {
    return candidatas.map((url) => ({ url, status: "bloqueada" }));
  }

  if (!aplicar) {
    // O diagnóstico só lê: não grava a marca, então não precisa da trava dos salvamentos.
    const usadas = await fotosEmUso(db);
    return candidatas.map((url) => ({ url, status: usadas.has(url) ? "preservada" : "candidata" }));
  }

  const resultado = await db.$transaction(async (tx) => {
    await bloquearFotos(tx);
    const usadas = await fotosEmUso(tx);
    const registros: ResultadoDescarte[] = [];
    for (const url of candidatas) {
      if (usadas.has(url)) {
        registros.push({ url, status: "preservada" });
        continue;
      }
      const existente = await tx.registroAuditoria.findFirst({ where: { acao: ACAO_DESCARTE, alvoTipo: "foto", alvoId: url } });
      if (!existente) await registrarAuditoria(tx, { usuarioId: null, acao: ACAO_DESCARTE, alvoTipo: "foto", alvoId: url });
      registros.push({ url, status: "candidata" });
    }
    return registros;
  }, LIMITE_DA_TRANSACAO);

  for (const foto of resultado) {
    if (foto.status !== "candidata") continue;
    try {
      await excluir(foto.url);
      foto.status = "descartada";
    } catch (erro) {
      // O registro permanece: uma resposta incerta não libera a URL para salvamento.
      console.error("Não foi possível apagar a foto", foto.url, erro);
      foto.status = "falha";
    }
  }
  return resultado;
}
