import Link from "next/link";
import { alternarSeguir } from "@/acoes/seguidores";
import { BotaoEnviar } from "@/components/BotaoEnviar";

/**
 * Seguir ou deixar de seguir um negócio. Sem login, o botão leva ao login e volta para `voltar`.
 * Quem já segue vê "Seguindo" e o botão para deixar de seguir.
 */
export function BotaoSeguir({
  empresaId,
  nome,
  logado,
  seguindo,
  voltar,
}: {
  empresaId: string;
  nome: string;
  logado: boolean;
  seguindo: boolean;
  voltar: string;
}) {
  if (!logado) {
    return (
      <Link href={`/entrar?voltar=${encodeURIComponent(voltar)}`} className="botao-coral">
        Seguir
      </Link>
    );
  }
  return (
    <form action={alternarSeguir} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="empresaId" value={empresaId} />
      <input type="hidden" name="seguir" value={seguindo ? "nao" : "sim"} />
      <input type="hidden" name="voltar" value={voltar} />
      {seguindo ? (
        <>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-folha-50 px-4 py-2.5 text-sm font-semibold text-folha">
            <span aria-hidden="true">✓</span> Seguindo
          </span>
          <BotaoEnviar
            className="text-sm text-suave underline-offset-4 hover:text-tinta hover:underline disabled:opacity-60"
            enviando="Salvando…"
            aria-label={`Deixar de seguir ${nome}`}
          >
            Deixar de seguir
          </BotaoEnviar>
        </>
      ) : (
        <BotaoEnviar className="botao-coral" enviando="Salvando…">
          Seguir
        </BotaoEnviar>
      )}
    </form>
  );
}
