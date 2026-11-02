import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { alternarSeguir } from "@/acoes/seguidores";
import { AvisoDaUrl } from "@/components/Avisos";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { EmpresaCard } from "@/components/EmpresaCard";
import { Paginacao } from "@/components/Paginacao";
import { exigirUsuario } from "@/lib/auth/sessao";
import { buscarSeguindo } from "@/lib/consultas";
import { FORA_DA_BUSCA } from "@/lib/seo";

export const metadata: Metadata = { title: "Seguindo", robots: FORA_DA_BUSCA };

export default function Seguindo(props: PageProps<"/seguindo">) {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
      <h1 className="font-serif text-4xl font-semibold tracking-tight">Seguindo</h1>
      <Suspense fallback={<div className="mt-8 h-80 animate-pulse rounded-3xl bg-superficie" />}>
        <Conteudo searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

const hrefPagina = (pagina: number) => (pagina > 1 ? `/seguindo?pagina=${pagina}` : "/seguindo");

async function Conteudo({ searchParams }: Pick<PageProps<"/seguindo">, "searchParams">) {
  const { aviso, pagina: paginaDaUrl } = await searchParams;
  const usuario = await exigirUsuario("/seguindo");
  const pedida = Number.parseInt(typeof paginaDaUrl === "string" ? paginaDaUrl : "1", 10);
  const { total, paginas, pagina, empresas } = await buscarSeguindo(usuario.id, Number.isFinite(pedida) && pedida > 0 ? pedida : 1);

  return (
    <div className="mt-2 space-y-8">
      <p className="text-suave">
        {total === 0
          ? "Os negócios que você segue aparecem aqui. Só você vê esta lista."
          : `Você segue ${total} ${total === 1 ? "negócio" : "negócios"}. Só você vê esta lista.`}
      </p>

      <AvisoDaUrl codigo={aviso} />

      {total === 0 ? (
        <div className="cartao p-8 text-center">
          <p className="font-serif text-2xl">Você ainda não segue nenhum negócio</p>
          <p className="mx-auto mt-2 max-w-md text-suave">
            No perfil de um negócio, toque em &ldquo;Seguir&rdquo; para acompanhá-lo por aqui.
          </p>
          <Link href="/explorar" className="botao-coral mt-6">
            Explorar o diretório
          </Link>
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {empresas.map((empresa) => (
              <li key={empresa.id} className="flex flex-col gap-2">
                <EmpresaCard empresa={empresa} />
                <form action={alternarSeguir} className="self-end">
                  <input type="hidden" name="empresaId" value={empresa.id} />
                  <input type="hidden" name="seguir" value="nao" />
                  <input type="hidden" name="voltar" value={hrefPagina(pagina)} />
                  <BotaoEnviar
                    className="px-2 py-1 text-sm text-suave underline-offset-4 hover:text-tinta hover:underline disabled:opacity-60"
                    enviando="Salvando…"
                    aria-label={`Deixar de seguir ${empresa.nome}`}
                  >
                    Deixar de seguir
                  </BotaoEnviar>
                </form>
              </li>
            ))}
          </ul>
          <Paginacao atual={pagina} total={paginas} href={hrefPagina} />
        </>
      )}
    </div>
  );
}
