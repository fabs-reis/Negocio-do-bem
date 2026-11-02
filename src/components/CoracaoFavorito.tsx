"use client";

import Link from "next/link";
import { useActionState } from "react";
import { favoritar } from "@/acoes/favoritos";

/** O que o coração de um negócio precisa saber (veja `coracoesDaLista`). */
export type EstadoFavorito = {
  empresaId: string;
  logado: boolean;
  favorito: boolean;
  /** A página a que o login devolve quem ainda não entrou. */
  voltar: string;
};

function Coracao({ cheio }: { cheio: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0"
      fill={cheio ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20.25s-8.25-4.6-8.25-11.1C3.75 6.4 5.9 4.5 8.3 4.5c1.6 0 3 .85 3.7 2.15.7-1.3 2.1-2.15 3.7-2.15 2.4 0 4.55 1.9 4.55 4.65 0 6.5-8.25 11.1-8.25 11.1Z" />
    </svg>
  );
}

const ICONE = "grid h-10 w-10 place-items-center rounded-full border border-linha bg-superficie shadow-sm transition hover:border-coral/40";

/**
 * O coração que põe um negócio nos favoritos ou tira dele, sem sair da página. Enquanto o
 * servidor responde, ele já mostra a escolha nova. Sem login, leva a `/entrar` e volta
 * para `estado.voltar`. `comTexto` é a versão do perfil, com o texto "Favoritar" ao lado.
 */
export function CoracaoFavorito({
  estado,
  nome,
  comTexto = false,
  className = "",
}: {
  estado: EstadoFavorito;
  nome: string;
  comTexto?: boolean;
  className?: string;
}) {
  const [favorito, acao, pendente] = useActionState(favoritar, estado.favorito);
  const mostrado = pendente ? !favorito : favorito;

  if (!estado.logado) {
    const entrar = `/entrar?voltar=${encodeURIComponent(estado.voltar)}`;
    return comTexto ? (
      <Link href={entrar} className={`botao-claro ${className}`}>
        <Coracao cheio={false} />
        Favoritar
      </Link>
    ) : (
      <Link href={entrar} aria-label={`Entre para favoritar ${nome}`} className={`${ICONE} text-suave hover:text-coral ${className}`}>
        <Coracao cheio={false} />
      </Link>
    );
  }

  return (
    <form action={acao} className={comTexto ? `flex flex-wrap items-center gap-3 ${className}` : className}>
      <input type="hidden" name="empresaId" value={estado.empresaId} />
      <input type="hidden" name="favoritar" value={favorito ? "nao" : "sim"} />
      <input type="hidden" name="voltar" value={estado.voltar} />
      {comTexto ? (
        <>
          <button
            type="submit"
            disabled={pendente}
            aria-pressed={mostrado}
            className={mostrado ? "botao-claro border-coral/40 bg-coral-50 text-coral-700 hover:bg-coral-50" : "botao-claro"}
          >
            <span className={mostrado ? "text-coral" : ""}>
              <Coracao cheio={mostrado} />
            </span>
            Favoritar
          </button>
          {mostrado && (
            <span className="text-sm text-suave">
              Está nos seus{" "}
              <Link href="/favoritos" className="link">
                favoritos
              </Link>
              .
            </span>
          )}
        </>
      ) : (
        <button
          type="submit"
          disabled={pendente}
          aria-pressed={mostrado}
          aria-label={`Favoritar ${nome}`}
          className={`${ICONE} ${mostrado ? "text-coral" : "text-suave hover:text-coral"}`}
        >
          <Coracao cheio={mostrado} />
        </button>
      )}
    </form>
  );
}
