import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Prazo } from "@/components/Prazo";
import { exigirUsuario } from "@/lib/auth/sessao";
import { db } from "@/lib/db";
import { rotuloDoDesconto, rotuloOndeVale, situacaoDoCupom, type SituacaoCupom } from "@/lib/ofertas";
import { FORA_DA_BUSCA } from "@/lib/seo";
import { formatarDataCurta } from "@/lib/texto";

export const metadata: Metadata = { title: "Meus cupons", robots: FORA_DA_BUSCA };

export default function MeusCupons() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-12 sm:px-6">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">Meus cupons</h1>
      <Suspense fallback={<div className="mt-8 h-80 animate-pulse rounded-3xl bg-superficie" />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}

const ROTULO: Record<Exclude<SituacaoCupom, "valido">, string> = {
  usado: "Usado",
  vencido: "Vencido",
  suspenso: "Oferta suspensa",
};

async function Conteudo() {
  const usuario = await exigirUsuario("/cupons");
  const cupons = await db.cupom.findMany({
    where: { usuarioId: usuario.id },
    orderBy: { criadoEm: "desc" },
    take: 100,
    include: { oferta: { include: { empresa: { select: { nome: true, instagramUsername: true } } } } },
  });
  const agora = new Date();
  const comSituacao = cupons.map((cupom) => ({ ...cupom, situacao: situacaoDoCupom(cupom, agora) }));
  const validos = comSituacao.filter((cupom) => cupom.situacao === "valido");
  const outros = comSituacao.filter((cupom) => cupom.situacao !== "valido");

  return (
    <div className="mt-2 space-y-8">
      <p className="text-suave">
        Mostre o código na hora da compra. O Negócio do Bem nunca pede Pix nem pagamento para liberar cupom.
      </p>

      {cupons.length === 0 ? (
        <div className="cartao p-8 text-center">
          <p className="font-serif text-2xl">Você ainda não tem cupons</p>
          <p className="mx-auto mt-2 max-w-md text-suave">
            Os negócios do Clube do Bem mostram as ofertas no perfil. Gere o cupom lá, e ele aparece aqui.
          </p>
          <Link href="/explorar" className="botao-coral mt-6">
            Explorar o diretório
          </Link>
        </div>
      ) : (
        <>
          {validos.length > 0 && (
            <ul className="space-y-4">
              {validos.map((cupom) => (
                <li key={cupom.id} className="cartao space-y-2 border-coral/40 p-5">
                  <Link href={`/empresas/${cupom.oferta.empresa.instagramUsername}`} className="font-medium hover:text-coral-700">
                    {cupom.oferta.empresa.nome}
                  </Link>
                  <p className="font-serif text-xl font-semibold">{cupom.oferta.titulo}</p>
                  <p className="text-sm text-suave">
                    {rotuloDoDesconto(cupom.oferta)} · {rotuloOndeVale(cupom.oferta.ondeVale)}
                  </p>
                  {cupom.oferta.condicoes && <p className="text-sm">{cupom.oferta.condicoes}</p>}
                  <p className="font-mono text-3xl tracking-[0.2em]">{cupom.codigo}</p>
                  <Prazo fim={cupom.oferta.fim.toISOString()} className="text-sm font-medium text-coral-700" />
                </li>
              ))}
            </ul>
          )}
          {outros.length > 0 && (
            <section>
              <h2 className="font-serif text-2xl font-semibold">Usados e vencidos</h2>
              <ul className="cartao mt-4 divide-y divide-linha">
                {outros.map((cupom) => (
                  <li key={cupom.id} className="flex flex-col gap-1 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">
                        {cupom.oferta.empresa.nome} · {cupom.oferta.titulo}
                      </p>
                      <p className="font-mono text-suave">{cupom.codigo}</p>
                    </div>
                    <p className="text-suave">
                      {cupom.situacao === "usado" && cupom.usadoEm
                        ? `Usado em ${formatarDataCurta(cupom.usadoEm)}`
                        : ROTULO[cupom.situacao as Exclude<SituacaoCupom, "valido">]}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
