import Link from "next/link";
import { sair } from "@/acoes/conta";
import { usuarioAtual } from "@/lib/auth/sessao";

export async function MenuUsuario() {
  const usuario = await usuarioAtual();

  if (!usuario) {
    return (
      <Link href="/entrar" className="botao botao-pequeno ml-1 focus-visible:outline-tinta">
        Entrar
      </Link>
    );
  }

  const primeiroNome = usuario.nome.split(" ")[0];
  return (
    <details className="group relative ml-1">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-linha bg-superficie py-1 pr-1 pl-1 text-sm font-semibold transition hover:border-tinta/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta sm:pr-3 [&::-webkit-details-marker]:hidden">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-amarelo font-display text-sm font-extrabold text-sobre-amarelo">
          {primeiroNome?.[0]?.toUpperCase()}
        </span>
        <span className="hidden max-w-24 truncate sm:inline">{primeiroNome}</span>
      </summary>
      <div className="absolute right-0 z-10 mt-2 w-56 overflow-hidden rounded-2xl border border-linha bg-superficie p-1.5 text-sm shadow-[0_12px_32px_-12px] shadow-tinta/25">
        <p className="truncate px-3 pt-2 pb-1 text-xs text-suave">{usuario.email}</p>
        <Link href="/painel" className="block rounded-xl px-3 py-2 font-medium hover:bg-papel">
          Meu painel
        </Link>
        {usuario.moderador && (
          <Link href="/moderacao" className="block rounded-xl px-3 py-2 font-medium hover:bg-papel">
            Moderação
          </Link>
        )}
        <form action={sair}>
          <button type="submit" className="block w-full rounded-xl px-3 py-2 text-left text-suave hover:bg-papel hover:text-tinta">
            Sair
          </button>
        </form>
      </div>
    </details>
  );
}
