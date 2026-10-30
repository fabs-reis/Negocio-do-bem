import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ConfirmarEmail } from "@/components/ConfirmarEmail";
import { Monograma } from "@/components/Monograma";
import { SeloStatus } from "@/components/SeloStatus";
import { exigirUsuario } from "@/lib/auth/sessao";
import { db } from "@/lib/db";
import { METODOS_REIVINDICACAO, MODERACAO_EMPRESA, STATUS_REIVINDICACAO } from "@/lib/dominio";
import { formatarData } from "@/lib/texto";
import { FORA_DA_BUSCA } from "@/lib/seo";
import "../area-interna.css";

export const metadata: Metadata = { title: "Meu painel", robots: FORA_DA_BUSCA };

export default function Painel() {
  return (
    <div className={`area-usuario container-editorial pagina-operacional`}>
      <header className="usuario-cabecalho"><div><p className="usuario-contexto">Sua participação na comunidade</p><h1>Meu painel</h1></div><div className="usuario-cabecalho-acoes"><Link href="/explorar" className="botao-claro">Explorar negócios ↗</Link><Link href="/sair" data-sem-cortina className="usuario-sair">Sair da conta</Link></div></header>
      <Suspense fallback={<div className="mt-8 h-80 animate-pulse rounded-3xl bg-superficie" />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}

const CORES_STATUS: Record<string, string> = {
  pendente: "bg-amber-50 text-amber-800",
  aprovada: "bg-folha-50 text-folha",
  recusada: "bg-coral-50 text-coral-700",
  expirada: "bg-papel text-suave",
  cancelada: "bg-papel text-suave",
  rejeitada: "bg-coral-50 text-coral-700",
};

function Etiqueta({ status, texto }: { status: string; texto: string }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${CORES_STATUS[status] ?? ""}`}>{texto}</span>;
}

async function Conteudo() {
  const usuario = await exigirUsuario("/painel");
  const [empresas, reivindicacoes, indicacoes] = await Promise.all([
    db.empresaMembro.findMany({
      where: { usuarioId: usuario.id },
      include: { empresa: true },
      orderBy: { criadoEm: "asc" },
    }),
    db.reivindicacao.findMany({
      where: { usuarioId: usuario.id, status: { not: "cancelada" } },
      include: { empresa: { select: { nome: true, instagramUsername: true } } },
      orderBy: { criadoEm: "desc" },
      take: 20,
    }),
    db.empresa.findMany({
      where: { indicadaPorId: usuario.id },
      orderBy: { criadoEm: "desc" },
      take: 30,
    }),
  ]);

  return (
    <div className="usuario-conteudo usuario-shell">
      <aside className="usuario-navegacao">
        <div className="usuario-identidade"><span aria-hidden="true">{usuario.nome[0]?.toUpperCase()}</span><div><strong>{usuario.nome}</strong><p>{usuario.email}</p></div></div>
        <nav className="usuario-secoes" aria-label="Seções da sua conta">
          <a href="#meus-negocios">Meus negócios <span>{empresas.length}</span></a>
          {reivindicacoes.length > 0 && <a href="#meus-pedidos">Pedidos recentes <span>{reivindicacoes.length}</span></a>}
          <a href="#minhas-indicacoes">Minhas indicações</a>
        </nav>
        <Link href="/indicar" className="usuario-indicar">Indicar um negócio <span aria-hidden="true">↗</span></Link>
      </aside>
      <div className="usuario-principal space-y-10">
      <section className="usuario-boas-vindas" aria-labelledby="titulo-boas-vindas"><div><p className="usuario-contexto">Bom ter você por aqui</p><h2 id="titulo-boas-vindas">Olá, {usuario.nome.split(" ")[0]}!</h2><p>Cuide das informações dos seus negócios e acompanhe sua participação na comunidade.</p></div><Link href={empresas.length === 1 ? `/painel/${empresas[0]!.empresa.instagramUsername}` : empresas.length ? "#meus-negocios" : "/indicar"} className="botao-coral">{empresas.length > 1 ? "Escolher um negócio" : empresas.length ? "Cuidar do meu negócio" : "Cadastrar meu negócio"} <span aria-hidden="true">↗</span></Link></section>

      {!usuario.emailConfirmado && (
        <ConfirmarEmail email={usuario.email} para="indicar, deixar depoimentos e assumir negócios" voltar="/painel" />
      )}

      <section id="meus-negocios">
        <div className="usuario-titulo-secao"><div><h2>Meus negócios</h2><p>Atualize o perfil que a comunidade encontra no diretório.</p></div><Link href="/indicar" className="link">Adicionar negócio ↗</Link></div>
        {empresas.length === 0 ? (
          <div className="cartao mt-4 p-6 text-suave">
            Você ainda não cuida de nenhum negócio por aqui.{" "}
            <Link href="/indicar" className="link">
              Cadastrar meu negócio
            </Link>{" "}
            ou procure por ele no{" "}
            <Link href="/explorar" className="link">
              diretório
            </Link>{" "}
            e clique em &ldquo;É meu negócio&rdquo;.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {empresas.map(({ empresa }) => (
              <div key={empresa.id} className="usuario-negocio cartao flex flex-col p-5">
                <div className="flex items-center gap-3">
                  <Monograma nome={empresa.nome} chave={empresa.instagramUsername} />
                  <div className="min-w-0">
                    <h3 className="usuario-nome-negocio"><Link href={`/painel/${empresa.instagramUsername}`}>{empresa.nome}</Link></h3>
                    <p className="text-sm text-suave">@{empresa.instagramUsername}</p>
                  </div>
                </div>
                <p className="usuario-local-negocio">{empresa.categoria} · {empresa.cidade}, {empresa.uf}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <SeloStatus status={empresa.status} />
                  {empresa.oculta && <Etiqueta status="expirada" texto="Oculto do diretório" />}
                  {!empresa.historia.trim() && <Etiqueta status="pendente" texto="Falta contar a história" />}
                </div>
                <div className="usuario-negocio-acoes mt-5 flex flex-wrap gap-2">
                  <Link href={`/painel/${empresa.instagramUsername}`} className="botao botao-pequeno">
                    Editar perfil
                  </Link>
                  <Link href={`/empresas/${empresa.instagramUsername}`} className="botao-claro botao-pequeno">
                    Ver perfil
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {reivindicacoes.length > 0 && (
        <section id="meus-pedidos">
          <h2 className="font-serif text-2xl font-semibold">Meus pedidos para assumir um perfil</h2>
          <ul className="cartao mt-4 divide-y divide-linha">
            {reivindicacoes.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Link href={`/empresas/${r.empresa.instagramUsername}/reivindicar`} className="font-medium hover:text-coral-700">
                    {r.empresa.nome}
                  </Link>
                  <p className="text-sm text-suave">
                    {METODOS_REIVINDICACAO[r.metodo]} · {formatarData(r.criadoEm)}
                  </p>
                  {r.status === "recusada" && r.motivoRecusa && (
                    <p className="mt-1 text-sm text-coral-700">Motivo: {r.motivoRecusa}</p>
                  )}
                </div>
                <Etiqueta status={r.status} texto={STATUS_REIVINDICACAO[r.status] ?? r.status} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section id="minhas-indicacoes">
        <h2 className="font-serif text-2xl font-semibold">Minhas indicações</h2>
        {indicacoes.length === 0 ? (
          <p className="mt-4 text-suave">
            Você ainda não indicou nenhum negócio.{" "}
            <Link href="/indicar" className="link">
              Indicar agora
            </Link>
          </p>
        ) : (
          <ul className="cartao mt-4 divide-y divide-linha">
            {indicacoes.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 p-4">
                <Link href={`/empresas/${e.instagramUsername}`} className="min-w-0 truncate font-medium hover:text-coral-700">
                  {e.nome} <span className="font-normal text-suave">@{e.instagramUsername}</span>
                </Link>
                <Etiqueta status={e.moderacao} texto={MODERACAO_EMPRESA[e.moderacao] ?? e.moderacao} />
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>
    </div>
  );
}
