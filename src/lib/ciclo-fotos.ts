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
  await bloquearFotos(tx);
  const fotos = [...fotosDaHistoria(historia)];
  if (fotos.length === 0) return;
  const descartada = await tx.registroAuditoria.findFirst({
    where: { acao: ACAO_DESCARTE, alvoTipo: "foto", alvoId: { in: fotos } },
    select: { id: true },
  });
  if (descartada) throw new ErroFotoDescartada();
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

  const resultado = await db.$transaction(async (tx) => {
    await bloquearFotos(tx);
    const empresas = await tx.empresa.findMany({ select: { historia: true, fotoUrl: true } });
    const usadas = new Set<string>();
    for (const empresa of empresas) {
      for (const foto of fotosDaHistoria(empresa.historia)) usadas.add(foto);
      const perfil = empresa.fotoUrl && identidadeDaFoto(empresa.fotoUrl);
      if (perfil) usadas.add(perfil);
    }
    const registros: ResultadoDescarte[] = [];
    for (const url of candidatas) {
      if (usadas.has(url)) {
        registros.push({ url, status: "preservada" });
        continue;
      }
      if (aplicar) {
        const existente = await tx.registroAuditoria.findFirst({ where: { acao: ACAO_DESCARTE, alvoTipo: "foto", alvoId: url } });
        if (!existente) await registrarAuditoria(tx, { usuarioId: null, acao: ACAO_DESCARTE, alvoTipo: "foto", alvoId: url });
      }
      registros.push({ url, status: "candidata" });
    }
    return registros;
  });

  if (!aplicar) return resultado;
  for (const foto of resultado) {
    if (foto.status !== "candidata") continue;
    try {
      await excluir(foto.url);
      foto.status = "descartada";
    } catch {
      // O registro permanece: uma resposta incerta não libera a URL para salvamento.
      foto.status = "falha";
    }
  }
  return resultado;
}
