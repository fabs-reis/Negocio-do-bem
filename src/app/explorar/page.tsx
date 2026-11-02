import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type CSSProperties, type ReactNode } from "react";
import { BuscaDiretorio } from "@/components/BuscaDiretorio";
import { EmpresaCard, type EmpresaResumo } from "@/components/EmpresaCard";
import { EmpresaLinha } from "@/components/EmpresaLinha";
import { Paginacao } from "@/components/Paginacao";
import { buscarCausa, CAUSAS, GRUPOS, type GrupoCausa } from "@/lib/causas";
import { buscarDiretorio } from "@/lib/consultas";
import { recomendacaoPublica } from "@/lib/cortejo";
import { alternar, hrefDiretorio, lerFiltros, mudarFiltro, ORDENS, tituloDoDiretorio, type FiltrosDiretorio, type Local, type Ordem } from "@/lib/diretorio";
import { CATEGORIAS } from "@/lib/dominio";
import { metadadosDaPagina } from "@/lib/seo";
import { OrdenarPor } from "./OrdenarPor";
import "./guia.css";

// Com filtros, o canônico continua sendo /explorar: as combinações de filtros
// não viram páginas separadas na busca. Os links dos filtros levam nofollow, e o
// robots.txt bloqueia /explorar?..., para os robôs não abrirem cada combinação.
export const metadata: Metadata = metadadosDaPagina({
  titulo: "Explorar negócios",
  descricao:
    "Busque negócios do bem por cidade, tipo de negócio e pelas causas que importam para você: liderados por mulheres, afroempreendedores, opções veganas, sustentáveis e mais.",
  caminho: "/explorar",
});

type Resultado = Awaited<ReturnType<typeof buscarDiretorio>>;
const TIPOS_VISIVEIS = 8;

export default function Explorar(props: PageProps<"/explorar">) {
  return (
    <div className="cortejo-guia-guia">
      <Link href="/" className="cortejo-guia-voltar">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6" /></svg>
        Início
      </Link>
      <Suspense fallback={<DiretorioCarregando />}>
        <Diretorio searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Diretorio({ searchParams }: Pick<PageProps<"/explorar">, "searchParams">) {
  const filtros = lerFiltros(await searchParams);
  const resultado = await buscarDiretorio(filtros);
  const ativos = filtrosAtivos(filtros, resultado.local);
  const marcados = filtros.tipos.length + filtros.causas.length + Number(filtros.verificados);
  // Só a apresentação pública chega aos componentes, sem ids privados nem a história inteira.
  const negocios: EmpresaResumo[] = resultado.itens.map((empresa) => ({
    instagramUsername: empresa.instagramUsername,
    nome: empresa.nome,
    fotoUrl: empresa.fotoUrl,
    resumo: empresa.resumo,
    categoria: empresa.categoria,
    cidade: empresa.cidade,
    uf: empresa.uf,
    status: empresa.status,
    causas: empresa.causas,
    _count: empresa._count,
    recomendacao: recomendacaoPublica({ historia: empresa.historia, motivoIndicacao: empresa.motivoIndicacao, indicadaPor: null }),
  }));

  return (
    <>
      <header className="cortejo-guia-abertura">
        <h1>{ativos.length ? tituloDoDiretorio(filtros, resultado.local) : "Conheça quem faz o bem."}</h1>
        <p>Busque pela sua cidade, pelo que precisa ou pelas causas que importam.</p>
      </header>
      <BuscaDiretorio cidades={resultado.cidades} filtros={filtros} />

      {ativos.length > 0 && (
        <nav aria-label="Filtros em uso" className="cortejo-guia-ativos">
          {ativos.map((ativo) => (
            <Link key={ativo.rotulo} href={ativo.href} scroll={false} rel="nofollow" aria-label={`Tirar o filtro ${ativo.rotulo}`} className="cortejo-guia-ativo">
              {ativo.rotulo}
              <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg>
            </Link>
          ))}
        </nav>
      )}

      <details className="cortejo-guia-filtros">
        <summary>
          <IconeFiltros />
          Escolher tipos e causas
          {marcados > 0 && <span className="cortejo-guia-quantidade">{marcados}<span className="sr-only"> filtros marcados</span></span>}
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 7 5 5 5-5" /></svg>
        </summary>
        <Filtros filtros={filtros} resultado={resultado} />
      </details>

      <div className="cortejo-guia-controles">
        <p aria-live="polite"><strong>{resultado.total.toLocaleString("pt-BR")}</strong> {resultado.total === 1 ? "negócio para conhecer" : "negócios para conhecer"}</p>
        <div className="cortejo-guia-vistas">
          <OrdenarPor atual={filtros.ordem} links={Object.fromEntries((Object.keys(ORDENS) as Ordem[]).map((ordem) => [ordem, mudarFiltro(filtros, { ordem })])) as Record<Ordem, string>} />
          <div role="group" aria-label="Modo de exibição">
            <BotaoVista href={hrefDiretorio({ ...filtros, vista: "grade" })} ativo={filtros.vista === "grade"} rotulo="Ver apresentações">
              <path d="M4 4h6v6H4zM14 5h6M14 9h6M4 14h6v6H4zM14 15h6M14 19h6" />
            </BotaoVista>
            <BotaoVista href={hrefDiretorio({ ...filtros, vista: "lista" })} ativo={filtros.vista === "lista"} rotulo="Ver lista compacta">
              <path d="M8 5h12M8 12h12M8 19h12M4 5h.01M4 12h.01M4 19h.01" />
            </BotaoVista>
          </div>
        </div>
      </div>

      {negocios.length > 0 ? (
        <ol key={hrefDiretorio(filtros)} className="cortejo-guia-lista" aria-label="Negócios encontrados">
          {negocios.map((empresa, indice) => (
            <li key={empresa.instagramUsername} style={{ "--atraso": `${Math.min(indice, 5) * 35}ms` } as CSSProperties}>
              {filtros.vista === "lista" ? <EmpresaLinha empresa={empresa} /> : <EmpresaCard empresa={empresa} />}
            </li>
          ))}
        </ol>
      ) : <Vazio filtros={filtros} resultado={resultado} />}

      <Paginacao atual={filtros.pagina} total={resultado.paginas} href={(pagina) => hrefDiretorio({ ...filtros, pagina })} />
      <div className="cortejo-guia-convite">
        <p>Tem um negócio que você gostaria de ver por aqui? A rede cresce com cada indicação.</p>
        <Link href="/participar" className="link text-sm font-bold">Indicar um negócio</Link>
      </div>
    </>
  );
}

function Filtros({ filtros, resultado }: { filtros: FiltrosDiretorio; resultado: Resultado }) {
  const tipos = CATEGORIAS.map((tipo) => ({ tipo, total: resultado.porCategoria[tipo] ?? 0, ativo: filtros.tipos.includes(tipo) })).sort(
    (a, b) => Number(b.ativo) - Number(a.ativo) || b.total - a.total || a.tipo.localeCompare(b.tipo, "pt-BR"),
  );
  const opcaoDeTipo = ({ tipo, total, ativo }: (typeof tipos)[number]) => (
    <OpcaoFiltro key={tipo} href={mudarFiltro(filtros, { tipos: alternar(filtros.tipos, tipo) })} ativo={ativo} total={total}>{tipo}</OpcaoFiltro>
  );
  return (
    <div className="cortejo-guia-opcoes">
      <section className="cortejo-guia-grupo">
        <h2>Tipo de negócio</h2>
        {tipos.slice(0, TIPOS_VISIVEIS).map(opcaoDeTipo)}
        <details className="group/mais">
          <summary className="cursor-pointer py-2 text-sm font-semibold underline underline-offset-4">
            <span className="group-open/mais:hidden">Ver os {CATEGORIAS.length} tipos</span>
            <span className="hidden group-open/mais:inline">Mostrar menos</span>
          </summary>
          {tipos.slice(TIPOS_VISIVEIS).map(opcaoDeTipo)}
        </details>
      </section>
      {(Object.keys(GRUPOS) as GrupoCausa[]).map((grupo) => (
        <section key={grupo} className="cortejo-guia-grupo">
          <h2>{GRUPOS[grupo]}</h2>
          {CAUSAS.filter((causa) => causa.grupo === grupo).map((causa) => {
            const ativo = filtros.causas.includes(causa.slug);
            return <OpcaoFiltro key={causa.slug} href={mudarFiltro(filtros, { causas: alternar(filtros.causas, causa.slug) })} ativo={ativo} total={ativo ? resultado.total : resultado.porCausa[causa.slug] ?? 0}>{causa.nome}</OpcaoFiltro>;
          })}
        </section>
      ))}
      <div className="cortejo-guia-filtroFinal">
        <OpcaoFiltro href={mudarFiltro(filtros, { verificados: !filtros.verificados })} ativo={filtros.verificados} total={resultado.verificados}>Só verificados pelo dono</OpcaoFiltro>
        {(filtros.tipos.length > 0 || filtros.causas.length > 0 || filtros.verificados) && <Link href={mudarFiltro(filtros, { tipos: [], causas: [], verificados: false })} scroll={false} rel="nofollow" className="link self-center text-sm font-semibold">Limpar tipos e causas</Link>}
      </div>
    </div>
  );
}

/** Uma opção de filtro: um link que marca ou desmarca, com quantos negócios ela mostra. */
function OpcaoFiltro({ href, ativo, total, children }: { href: string; ativo: boolean; total: number; children: ReactNode }) {
  return (
    <Link href={href} scroll={false} rel="nofollow" aria-current={ativo ? "true" : undefined} className="cortejo-guia-opcao">
      <span className="cortejo-guia-caixa" aria-hidden="true">{ativo && <svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="m4 10 4 4 8-8" /></svg>}</span>
      <span>{children}{ativo && <span className="sr-only"> (marcado)</span>}</span>
      <span className="cortejo-guia-contagem">{total}</span>
    </Link>
  );
}

function BotaoVista({ href, ativo, rotulo, children }: { href: string; ativo: boolean; rotulo: string; children: ReactNode }) {
  return <Link href={href} scroll={false} rel="nofollow" aria-label={rotulo} aria-current={ativo ? "true" : undefined} className="cortejo-guia-vista"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg></Link>;
}

function Vazio({ filtros, resultado }: { filtros: FiltrosDiretorio; resultado: Resultado }) {
  if (resultado.total > 0) {
    return <div className="cortejo-guia-vazio"><h2>Essa página não existe.</h2><Link href={hrefDiretorio({ ...filtros, pagina: 1 })} className="botao-claro mt-5">Voltar para a primeira página</Link></div>;
  }
  const soOLugar = resultado.local?.cidade && !filtros.q && filtros.tipos.length === 0 && filtros.causas.length === 0 && !filtros.verificados;
  return (
    <div className="cortejo-guia-vazio">
      <h2>{soOLugar ? `Ainda não há negócios do bem em ${resultado.local!.cidade} no diretório.` : "Nenhum negócio com esses filtros por enquanto."}</h2>
      <p>{soOLugar ? "Conhece algum por lá? Indique e ajude a comunidade a encontrá-lo." : "Tire um filtro para ver mais opções, ou indique um negócio que você conhece."}</p>
      <div className="mt-6 flex flex-wrap gap-3"><Link href="/explorar" className="botao-claro">Limpar a busca</Link><Link href="/participar" className="botao-coral">Indicar um negócio</Link></div>
    </div>
  );
}

/** Os filtros em uso, cada um com o link que o tira. */
function filtrosAtivos(filtros: FiltrosDiretorio, local: Local | null) {
  const ativos: { rotulo: string; href: string }[] = [];
  if (filtros.q) ativos.push({ rotulo: `“${filtros.q}”`, href: mudarFiltro(filtros, { q: "" }) });
  if (filtros.onde) ativos.push({ rotulo: local?.rotulo ?? filtros.onde, href: mudarFiltro(filtros, { onde: "" }) });
  for (const tipo of filtros.tipos) ativos.push({ rotulo: tipo, href: mudarFiltro(filtros, { tipos: alternar(filtros.tipos, tipo) }) });
  for (const causa of filtros.causas) ativos.push({ rotulo: buscarCausa(causa)?.nome ?? causa, href: mudarFiltro(filtros, { causas: alternar(filtros.causas, causa) }) });
  if (filtros.verificados) ativos.push({ rotulo: "Só verificados", href: mudarFiltro(filtros, { verificados: false }) });
  return ativos;
}

function IconeFiltros() {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true"><path d="M4 7h9m4 0h3M4 17h3m4 0h9M15 5v4M9 15v4" /></svg>;
}

function DiretorioCarregando() {
  return <div aria-busy="true" className="py-8"><p className="font-display text-3xl font-bold">Conheça quem faz o bem.</p><p className="mt-3 text-suave">Carregando os negócios da comunidade…</p></div>;
}
