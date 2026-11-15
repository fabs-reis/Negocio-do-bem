import "server-only";
import { db, type Prisma } from "@/lib/db";
import { CATEGORIAS_SERVICOS, limitarPagina, numeroPagina, POR_PAGINA_SERVICOS } from "@/lib/servicos";
import { normalizarTexto } from "@/lib/texto";
import { conferirMunicipio } from "@/lib/municipios";

/** O mesmo filtro rege resultados e contagens; somente anúncios visíveis são retornados. */
export function filtroServicosPublicos(
  q: string, categoria: string,
  localizacao?: { cidade: string; uf: string } | null,
  modalidade: "" | "remoto" | "presencial" = "",
): Prisma.ServicoWhereInput {
  const termos = normalizarTexto(q).slice(0, 100).split(" ").filter(Boolean).slice(0, 6);
  const criterios: Prisma.ServicoWhereInput[] = termos.map((termo) => ({ busca: { contains: termo } }));
  if (modalidade === "remoto") {
    criterios.push({ remoto: true });
  } else if (localizacao) {
    const presencialNaArea: Prisma.ServicoWhereInput = {
      presencial: true,
      areasAtendimento: { some: { cidade: localizacao.cidade, uf: localizacao.uf } },
    };
    criterios.push(modalidade === "presencial" ? presencialNaArea : { OR: [{ remoto: true }, presencialNaArea] });
  } else if (modalidade === "presencial") {
    criterios.push({ presencial: true });
  }
  return {
    status: "publicado",
    oculto: false,
    OR: [
      { perfil: { is: { publicado: true } } },
      { empresa: { is: { moderacao: "aprovada", oculta: false, status: "verificada" } } },
    ],
    ...(CATEGORIAS_SERVICOS.some((nome) => nome === categoria) ? { categoria } : {}),
    AND: criterios,
  };
}

export async function listarServicosPublicos(filtros: {
  q: string; categoria: string; pagina: unknown; municipio?: string; modalidade?: string;
}) {
  const q = filtros.q.slice(0, 100);
  const categoria = CATEGORIAS_SERVICOS.find((nome) => nome === filtros.categoria) ?? "";
  const municipio = (filtros.municipio ?? "").trim().slice(0, 120);
  const modalidade = filtros.modalidade === "remoto" || filtros.modalidade === "presencial" ? filtros.modalidade : "";
  const resultado = municipio ? conferirMunicipio(municipio) : null;
  const municipioInvalido = !!resultado && "erro" in resultado;
  const localizacao = resultado && "municipio" in resultado
    ? { cidade: resultado.municipio.nome, uf: resultado.municipio.uf } : null;
  const where: Prisma.ServicoWhereInput = municipioInvalido
    ? { id: { in: [] } }
    : filtroServicosPublicos(q, categoria, localizacao, modalidade);
  const total = await db.servico.count({ where });
  const { pagina, paginas } = limitarPagina(numeroPagina(filtros.pagina), total);
  const itens = await db.servico.findMany({
    where,
    select: {
      id: true, titulo: true, descricao: true, categoria: true, cidade: true, uf: true,
      remoto: true, presencial: true, precoReferencia: true,
      areasAtendimento: { select: { cidade: true, uf: true }, orderBy: [{ uf: "asc" }, { cidade: "asc" }] },
      perfil: { select: { nomePublico: true, emailContato: true, site: true } },
      empresa: { select: { nome: true, instagramUsername: true } },
    },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
    skip: (pagina - 1) * POR_PAGINA_SERVICOS,
    take: POR_PAGINA_SERVICOS,
  });
  return { itens, total, pagina, paginas, q, categoria, municipio, modalidade, municipioInvalido };
}
