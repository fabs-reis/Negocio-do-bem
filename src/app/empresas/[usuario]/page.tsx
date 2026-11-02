import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type CSSProperties } from "react";
import { denunciarDepoimento } from "@/acoes/depoimentos";
import { AvisoDaUrl } from "@/components/Avisos";
import { CausaBadge } from "@/components/CausaBadge";
import { ConfirmarEmail } from "@/components/ConfirmarEmail";
import { Historia } from "@/components/Historia";
import { JsonLd } from "@/components/JsonLd";
import { FotoEmpresa } from "@/components/FotoEmpresa";
import { InstagramIcone, WhatsAppIcone } from "@/components/Icones";
import { LinkInstagram } from "@/components/LinkInstagram";
import { SeloStatus } from "@/components/SeloStatus";
import { usuarioAtual, type UsuarioSessao } from "@/lib/auth/sessao";
import { buscarCausa, filtrarCausas } from "@/lib/causas";
import { buscarPerfil, ehDono, podeVerPerfil } from "@/lib/consultas";
import { tintaDoNegocio } from "@/lib/cortejo";
import { hrefCausa, hrefTipo, temPaginaDeTipo } from "@/lib/diretorio";
import { MODERACAO_EMPRESA } from "@/lib/dominio";
import { temInstagram } from "@/lib/endereco";
import { linkPerfil, normalizarEndereco } from "@/lib/instagram";
import { medirContato, type CanalDeContato } from "@/lib/medicao";
import { FORA_DA_BUSCA, jsonLdDoNegocio, metadadosDaPagina, paginaDaCidade } from "@/lib/seo";
import { formatarData, formatarTelefone, tempoDeLeitura } from "@/lib/texto";
import { FormDepoimento } from "./FormDepoimento";
import "./perfil.css";

export async function generateMetadata(props: PageProps<"/empresas/[usuario]">): Promise<Metadata> {
  const username = normalizarEndereco((await props.params).usuario);
  const empresa = username ? await buscarPerfil(username) : null;
  if (!empresa || empresa.moderacao !== "aprovada" || empresa.oculta) return { title: "Perfil", robots: FORA_DA_BUSCA };
  // "Café da Ana — Café e padaria em Salvador, BA": o que as pessoas buscam é o tipo e a cidade.
  const onde = `${empresa.cidade}, ${empresa.uf}`;
  return metadadosDaPagina({
    titulo: empresa.categoria === "Outros" ? `${empresa.nome} em ${onde}` : `${empresa.nome} — ${empresa.categoria} em ${onde}`,
    descricao: empresa.resumo,
    caminho: `/empresas/${empresa.instagramUsername}`,
    imagemPropria: true,
  });
}

export default function PaginaEmpresa(props: PageProps<"/empresas/[usuario]">) {
  return (
    <Suspense fallback={<PerfilCarregando />}>
      <Perfil params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

type Perfil = NonNullable<Awaited<ReturnType<typeof buscarPerfil>>>;

async function Perfil({ params, searchParams }: Pick<PageProps<"/empresas/[usuario]">, "params" | "searchParams">) {
  const username = normalizarEndereco((await params).usuario);
  if (!username) notFound();
  const [empresa, usuario, { aviso }] = await Promise.all([buscarPerfil(username), usuarioAtual(), searchParams]);
  if (!empresa || !podeVerPerfil(empresa, usuario)) notFound();

  const dono = ehDono(empresa, usuario);
  const causas = filtrarCausas(empresa.causas.map((c) => c.causa));
  const publico = empresa.moderacao === "aprovada" && !empresa.oculta;
  const tinta = tintaDoNegocio(empresa.instagramUsername);
  const cores = {
    "--tinta-negocio": `var(--color-${tinta})`,
    "--texto-negocio": `var(--color-${tinta}-texto)`,
  } as CSSProperties;
  // Os cliques nos contatos contam no Analytics só quando vêm do público, não do dono.
  const contato = publico && !dono ? empresa : undefined;

  return (
    <article className={"cortejo-perfil"} style={cores}>
      {publico && <JsonLd dados={jsonLdDoNegocio(empresa, causas.map((slug) => buscarCausa(slug)!.nome))} />}
      <header className={"cortejo-perfil-cabecalho"}>
        <div className={"cortejo-perfil-abertura"}>
          <Link href="/explorar" className={"cortejo-perfil-voltar"}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m8 4-6 6 6 6M2 10h16" /></svg>
            Explorar negócios
          </Link>
          <div className={"cortejo-perfil-avisos"}>
            <AvisoDaUrl codigo={aviso} />
            {!publico && (
              <p className={"cortejo-perfil-restrito"}>
                {empresa.oculta
                  ? "Este perfil está oculto pelo dono e não aparece no diretório."
                  : `${MODERACAO_EMPRESA[empresa.moderacao]}: só você e a moderação veem este perfil por enquanto.`}
              </p>
            )}
          </div>

          <div className={"cortejo-perfil-identidade"}>
            <div className={"cortejo-perfil-retrato"}><FotoEmpresa empresa={empresa} tamanho="lg" /></div>
            <div className={"cortejo-perfil-nome"}>
              <SeloStatus status={empresa.status} />
              <h1>{empresa.nome}</h1>
              <div className={"cortejo-perfil-metadados"}>
                <LinkInstagram endereco={empresa.instagramUsername} icone contato={contato} />
                {publico && temPaginaDeTipo(empresa.categoria) ? <Link href={hrefTipo(empresa.categoria)}>{empresa.categoria}</Link> : <span>{empresa.categoria}</span>}
                {publico ? (
                  <Link href={paginaDaCidade(empresa.cidade, empresa.uf).caminho}>{empresa.cidade}, {empresa.uf}</Link>
                ) : <span>{empresa.cidade}, {empresa.uf}</span>}
              </div>
            </div>
          </div>
          <p className={"cortejo-perfil-resumo"}>{empresa.resumo}</p>
          <Contatos empresa={empresa} medir={!!contato} />

          {causas.length > 0 && (
            <section className={"cortejo-perfil-causas"} aria-label="Causas do negócio">
              <h2>As causas que abraçam</h2>
              <div>
                {causas.map((slug) => publico ? (
                  <Link key={slug} href={hrefCausa(slug)}><CausaBadge slug={slug} grande /></Link>
                ) : <CausaBadge key={slug} slug={slug} grande />)}
              </div>
            </section>
          )}
          {dono ? (
            <Link href={`/painel/${empresa.instagramUsername}`} className={`botao-claro cortejo-perfil-editar`}>Editar meu perfil</Link>
          ) : usuario?.moderador ? (
            <Link href={`/moderacao/negocios/${empresa.instagramUsername}`} className={`botao-claro cortejo-perfil-editar`}>Editar perfil (moderação)</Link>
          ) : null}
        </div>
      </header>

      <div className={"cortejo-perfil-conteudo"}>
        <section className={"cortejo-perfil-historia"}>
          {empresa.historia.trim() ? (
            <>
              <h2>Nossa história</h2>
              <p className={"cortejo-perfil-dadosHistoria"}>
                <span>{tempoDeLeitura(empresa.historia)} min de leitura</span>
                <span>Atualizada em <time dateTime={empresa.atualizadoEm.toISOString()}>{formatarData(empresa.atualizadoEm)}</time></span>
              </p>
              <Historia markdown={empresa.historia} />
            </>
          ) : <SemHistoria empresa={empresa} dono={dono} />}
        </section>
        {empresa.status !== "verificada" && !dono && <ChamadaReivindicar username={empresa.instagramUsername} />}
        <Depoimentos empresa={empresa} usuario={usuario} dono={dono} publico={publico} />
        {empresa.status === "verificada" && !dono && (
          <p className={"cortejo-perfil-disputa"}>
            Este perfil é seu e outra pessoa assumiu?{" "}
            <Link href={`/empresas/${empresa.instagramUsername}/reivindicar`} className="link">Fale com a moderação</Link>
          </p>
        )}
      </div>
    </article>
  );
}

/**
 * Os botões de contato. WhatsApp, Instagram e site abrem numa aba nova, para a pessoa não sair do site.
 * Com `medir`, cada clique vira o evento `contato_negocio` no Analytics.
 */
function Contatos({ empresa, medir }: { empresa: Perfil; medir: boolean }) {
  const instagram = temInstagram(empresa.instagramUsername);
  if (!empresa.telefoneComercial && !empresa.whatsapp && !instagram && !empresa.site && !empresa.emailContato) return null;
  const medida = (canal: CanalDeContato) => (medir ? medirContato(canal, empresa) : {});
  return (
    <div className={"cortejo-perfil-contatos"}>
      {empresa.telefoneComercial && (
        <a href={`tel:+${empresa.telefoneComercial}`} className="botao botao-pequeno" {...medida("telefone")}>
          Ligar {formatarTelefone(empresa.telefoneComercial)}
        </a>
      )}
      {empresa.whatsapp && (
        <a
          href={`https://wa.me/${empresa.whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          className="botao botao-pequeno"
          {...medida("whatsapp")}
        >
          <WhatsAppIcone />
          WhatsApp {formatarTelefone(empresa.whatsapp)}
        </a>
      )}
      {instagram && (
        <a
          href={linkPerfil(empresa.instagramUsername)}
          target="_blank"
          rel="noopener noreferrer"
          className="botao-claro botao-pequeno"
          {...medida("instagram")}
        >
          <InstagramIcone />
          Instagram
        </a>
      )}
      {empresa.site && (
        <a href={empresa.site} target="_blank" rel="noopener noreferrer nofollow" className="botao-claro botao-pequeno" {...medida("site")}>
          {new URL(empresa.site).hostname.replace(/^www\./, "")} ↗
        </a>
      )}
      {empresa.emailContato && (
        // break-all: um e-mail comprido quebra em vez de passar da largura do celular.
        <a href={`mailto:${empresa.emailContato}`} className="botao-claro botao-pequeno max-w-full break-all" {...medida("email")}>
          {empresa.emailContato}
        </a>
      )}
    </div>
  );
}

function SemHistoria({ empresa, dono }: { empresa: Perfil; dono: boolean }) {
  if (dono) return (
    <div className={"cortejo-perfil-conviteHistoria"}>
      <h2>Conte a história do seu negócio</h2>
      <p>Como tudo começou, o que move vocês, quem faz acontecer. É aqui que a comunidade conhece vocês de verdade.</p>
      <Link href={`/painel/${empresa.instagramUsername}`} className="botao-coral">Escrever nossa história</Link>
    </div>
  );
  if (empresa.motivoIndicacao) return (
    <figure className={"cortejo-perfil-bilhete"}>
      <h2>Por que foi indicado</h2>
      <blockquote>“{empresa.motivoIndicacao}”</blockquote>
      {empresa.indicadaPor && <figcaption>Indicado por {empresa.indicadaPor.nome}</figcaption>}
    </figure>
  );
  return <p className={"cortejo-perfil-semHistoria"}>A história deste negócio ainda vai ser contada.</p>;
}

function ChamadaReivindicar({ username }: { username: string }) {
  return (
    <aside className={"cortejo-perfil-assumir"}>
      <div>
        <p>Este negócio é seu?</p>
        <p>Reivindique o perfil para contar a sua história, escolher suas causas e responder à comunidade.</p>
      </div>
      <Link href={`/empresas/${username}/reivindicar`} className="botao-coral">Sou o dono</Link>
    </aside>
  );
}

function Depoimentos({ empresa, usuario, dono, publico }: { empresa: Perfil; usuario: UsuarioSessao | null; dono: boolean; publico: boolean }) {
  const jaEscreveu = !!usuario && empresa.depoimentos.some((d) => d.autorId === usuario.id);
  return (
    <section id="depoimentos" className={"cortejo-perfil-depoimentos"}>
      <h2>Depoimentos da comunidade</h2>
      <p>Experiências reais de quem conhece este negócio.</p>
      {publico && !dono && !jaEscreveu && (
        <div className={"cortejo-perfil-formularioDepoimento"}>
          {usuario?.emailConfirmado ? (
            <FormDepoimento empresaId={empresa.id} nomeEmpresa={empresa.nome} />
          ) : usuario ? (
            <ConfirmarEmail
              email={usuario.email}
              para="deixar seu depoimento"
              voltar={`/empresas/${empresa.instagramUsername}#depoimentos`}
            />
          ) : (
            <div className={"cortejo-perfil-entrar"}>
              <Link href={`/entrar?voltar=${encodeURIComponent(`/empresas/${empresa.instagramUsername}#depoimentos`)}`} className="botao-claro">Entrar para deixar um depoimento</Link>
              <p>Sua experiência ajuda outras pessoas a conhecer este negócio.</p>
            </div>
          )}
        </div>
      )}
      <div className={"cortejo-perfil-listaDepoimentos"}>
        {empresa.depoimentos.length === 0 && <p className="text-suave italic">Ainda não há depoimentos. Que tal ser a primeira pessoa?</p>}
        {empresa.depoimentos.map((depoimento) => (
          <figure key={depoimento.id} className={"cortejo-perfil-depoimento"}>
            <blockquote>{depoimento.texto}</blockquote>
            <figcaption>
              <span><strong>{depoimento.autor.nome}</strong> · <time dateTime={depoimento.criadoEm.toISOString()}>{formatarData(depoimento.criadoEm)}</time></span>
              {usuario && usuario.id !== depoimento.autorId && !depoimento.denunciado && (
                <details className={"cortejo-perfil-denuncia"}>
                  <summary>Denunciar</summary>
                  <form action={denunciarDepoimento}>
                    <input type="hidden" name="depoimentoId" value={depoimento.id} />
                    <input name="motivo" aria-label="Motivo da denúncia" placeholder="O que há de errado?" className="campo" maxLength={300} />
                    <button type="submit" className="botao-claro botao-pequeno">Enviar</button>
                  </form>
                </details>
              )}
            </figcaption>
            {depoimento.resposta && (
              <div className={"cortejo-perfil-resposta"}>
                <p>Resposta de {empresa.nome}</p>
                <p>{depoimento.resposta}</p>
              </div>
            )}
          </figure>
        ))}
      </div>
    </section>
  );
}

function PerfilCarregando() {
  return <div className={`cortejo-perfil-conteudo cortejo-perfil-carregando`} aria-busy="true" aria-label="Carregando perfil"><div /></div>;
}
