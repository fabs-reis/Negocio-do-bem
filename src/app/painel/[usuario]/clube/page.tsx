import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { encerrarOfertaAcao, usarCupomAcao } from "@/acoes/ofertas";
import { AvisoDaUrl } from "@/components/Avisos";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { Prazo } from "@/components/Prazo";
import { exigirUsuario } from "@/lib/auth/sessao";
import { podeCriarOfertas } from "@/lib/clube";
import { db } from "@/lib/db";
import { normalizarEndereco } from "@/lib/instagram";
import {
  DIAS_MAXIMOS,
  DIAS_PADRAO,
  hojeEmBrasilia,
  normalizarCodigo,
  rotuloDoDesconto,
  rotuloOndeVale,
  situacaoDoCupom,
  somarDias,
} from "@/lib/ofertas";
import { FORA_DA_BUSCA } from "@/lib/seo";
import { formatarDataCurta, formatarDataHora } from "@/lib/texto";
import { FormOferta } from "./FormOferta";

export const metadata: Metadata = { title: "Clube do Bem", robots: FORA_DA_BUSCA };

export default function ClubeDoNegocio(props: PageProps<"/painel/[usuario]/clube">) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-12 sm:px-6">
      <Suspense fallback={<div className="h-[30rem] animate-pulse rounded-3xl bg-superficie" />}>
        <Conteudo params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

const SITUACAO_DO_CUPOM = {
  valido: { texto: "Válido", cor: "text-folha" },
  usado: { texto: "Já usado", cor: "text-coral-700" },
  vencido: { texto: "Vencido", cor: "text-coral-700" },
  suspenso: { texto: "Oferta suspensa pela moderação", cor: "text-coral-700" },
} as const;

function situacaoDaOferta(oferta: { status: string; fim: Date }, agora: Date): string {
  if (oferta.status === "suspensa") return "Suspensa";
  if (oferta.status === "encerrada") return "Encerrada";
  return oferta.fim > agora ? "Valendo" : "Terminou";
}

async function Conteudo({ params, searchParams }: Pick<PageProps<"/painel/[usuario]/clube">, "params" | "searchParams">) {
  const username = normalizarEndereco((await params).usuario);
  if (!username) notFound();
  const usuario = await exigirUsuario(`/painel/${username}/clube`);
  const empresa = await db.empresa.findUnique({
    where: { instagramUsername: username },
    include: {
      membros: { select: { usuarioId: true } },
      ofertas: {
        orderBy: { criadoEm: "desc" },
        take: 20,
        include: { _count: { select: { cupons: { where: { usadoEm: { not: null } } } } } },
      },
    },
  });
  if (!empresa || !empresa.membros.some((m) => m.usuarioId === usuario.id)) notFound();
  const { aviso, codigo: codigoDaUrl } = await searchParams;
  const [liberado, liberacao] = await Promise.all([
    podeCriarOfertas(empresa.id, usuario.id),
    db.liberacaoClube.findUnique({ where: { empresaId_usuarioId: { empresaId: empresa.id, usuarioId: usuario.id } } }),
  ]);
  const agora = new Date();
  const ativa = empresa.ofertas.find((oferta) => oferta.status === "ativa" && oferta.fim > agora);
  const codigo = typeof codigoDaUrl === "string" ? normalizarCodigo(codigoDaUrl) : "";
  const cupom = codigo
    ? await db.cupom.findUnique({ where: { codigo }, include: { oferta: true, usuario: { select: { nome: true } } } })
    : null;
  const cupomDaqui = cupom && cupom.oferta.empresaId === empresa.id ? cupom : null;
  const hoje = hojeEmBrasilia(agora);
  const avisoDaValidacao = typeof aviso === "string" && aviso.startsWith("cupom_") ? aviso : undefined;

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <Link href={`/painel/${empresa.instagramUsername}`} className="text-sm text-suave hover:text-tinta">
          ← {empresa.nome}
        </Link>
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-coral-700 uppercase">Clube do Bem</p>
          <h1 className="mt-1 font-serif text-4xl font-semibold tracking-tight">Ofertas e cupons</h1>
        </div>
        {/* Os avisos da validação aparecem junto do cupom, para onde a página volta. */}
        {!avisoDaValidacao && <AvisoDaUrl codigo={aviso} />}
      </div>

      <section id="validar" className="scroll-mt-24 space-y-4">
        <h2 className="font-serif text-2xl font-semibold">Validar um cupom</h2>
        <form action={`/painel/${empresa.instagramUsername}/clube#validar`} method="get" className="cartao space-y-3 p-5">
          <label htmlFor="codigo" className="rotulo">
            Código que a pessoa mostrou
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="codigo"
              name="codigo"
              required
              autoCapitalize="characters"
              autoComplete="off"
              defaultValue={codigo}
              placeholder="7K3P9Q"
              className="campo font-mono tracking-[0.2em] uppercase"
            />
            <button type="submit" className="botao whitespace-nowrap">
              Conferir
            </button>
          </div>
        </form>
        {avisoDaValidacao !== "cupom_usado" && <AvisoDaUrl codigo={avisoDaValidacao} />}
        {codigo &&
          (!cupomDaqui ? (
            <p className="cartao p-5 text-sm text-coral-700">Não achamos um cupom com esse código neste negócio. Confira as letras.</p>
          ) : (
            <CupomConferido cupom={cupomDaqui} empresaId={empresa.id} agora={agora} usadoAgora={avisoDaValidacao === "cupom_usado"} />
          ))}
      </section>

      <section className="space-y-4">
        {!liberado ? (
          <div className="cartao space-y-2 p-6 text-sm leading-relaxed">
            <h2 className="font-serif text-2xl font-semibold">Criar ofertas</h2>
            {liberacao?.status === "suspensa" ? (
              <p className="text-coral-700">
                A liberação do seu negócio no clube foi suspensa. Motivo: {liberacao.motivo}. Fale com a moderação para conferir de
                novo.
              </p>
            ) : (
              <p className="text-suave">
                O Clube do Bem está em fase de convite: a moderação libera negócios com CNPJ ativo, depois de conferir a ficha na
                Receita. Se o seu negócio foi convidado, fale com a moderação.
              </p>
            )}
          </div>
        ) : ativa ? (
          <div className="cartao space-y-3 p-6">
            <p className="text-xs font-semibold tracking-[0.2em] text-folha uppercase">Valendo agora</p>
            <h2 className="font-serif text-2xl font-semibold">{ativa.titulo}</h2>
            <p className="text-sm text-suave">
              {rotuloDoDesconto(ativa)} · {rotuloOndeVale(ativa.ondeVale)} · <Prazo fim={ativa.fim.toISOString()} />
            </p>
            {ativa.condicoes && <p className="text-sm">{ativa.condicoes}</p>}
            <p className="text-sm">
              <strong>{ativa.cuponsGerados}</strong> {ativa.cuponsGerados === 1 ? "cupom gerado" : "cupons gerados"}
              {ativa.limite !== null && ` de ${ativa.limite}`} · <strong>{ativa._count.cupons}</strong>{" "}
              {ativa._count.cupons === 1 ? "usado" : "usados"}
            </p>
            <form action={encerrarOfertaAcao}>
              <input type="hidden" name="ofertaId" value={ativa.id} />
              <BotaoEnviar className="botao-claro botao-pequeno" enviando="Encerrando…">
                Encerrar a oferta
              </BotaoEnviar>
            </form>
          </div>
        ) : (
          <FormOferta
            empresaId={empresa.id}
            hoje={hoje}
            ultimoDiaPadrao={somarDias(hoje, DIAS_PADRAO - 1)}
            ultimoDiaMaximo={somarDias(hoje, DIAS_MAXIMOS - 1)}
          />
        )}
      </section>

      {empresa.ofertas.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-serif text-2xl font-semibold">Ofertas do negócio</h2>
          <ul className="cartao divide-y divide-linha">
            {empresa.ofertas.map((oferta) => (
              <li key={oferta.id} className="flex flex-col gap-1 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">{oferta.titulo}</p>
                  <p className="text-suave">
                    {formatarDataCurta(oferta.inicio)} a {formatarDataCurta(oferta.fim)} · {situacaoDaOferta(oferta, agora)}
                  </p>
                </div>
                <p className="text-suave">
                  {oferta.cuponsGerados} {oferta.cuponsGerados === 1 ? "cupom" : "cupons"} · {oferta._count.cupons}{" "}
                  {oferta._count.cupons === 1 ? "usado" : "usados"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function CupomConferido({
  cupom,
  empresaId,
  agora,
  usadoAgora,
}: {
  cupom: {
    codigo: string;
    usadoEm: Date | null;
    usuario: { nome: string };
    oferta: { titulo: string; tipo: string; valor: number | null; fim: Date; status: string };
  };
  empresaId: string;
  agora: Date;
  /** Acabou de ser marcado como usado nesta tela: é a confirmação, e não um alerta. */
  usadoAgora: boolean;
}) {
  const situacao = situacaoDoCupom(cupom, agora);
  const { texto, cor } = usadoAgora && situacao === "usado" ? { texto: "Usado agora. Pode dar o desconto.", cor: "text-folha" } : SITUACAO_DO_CUPOM[situacao];
  return (
    <div className="cartao space-y-3 p-5 text-sm">
      <p className="font-mono text-2xl tracking-[0.2em]">{cupom.codigo}</p>
      <p className={`font-medium ${cor}`}>
        {texto}
        {situacao === "usado" && !usadoAgora && cupom.usadoEm && ` em ${formatarDataHora(cupom.usadoEm)}`}
      </p>
      <p>
        {cupom.oferta.titulo} · {rotuloDoDesconto(cupom.oferta)}
      </p>
      {/* Só o primeiro nome: o clube não entrega lista de clientes. */}
      <p className="text-suave">De {cupom.usuario.nome.split(" ")[0]}</p>
      {situacao === "valido" && (
        <form action={usarCupomAcao}>
          <input type="hidden" name="empresaId" value={empresaId} />
          <input type="hidden" name="codigo" value={cupom.codigo} />
          <BotaoEnviar className="botao-coral" enviando="Marcando…">
            Marcar como usado
          </BotaoEnviar>
        </form>
      )}
    </div>
  );
}
