import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { caminhoSeguro, usuarioAtual } from "@/lib/auth/sessao";
import { BotoesOAuth } from "@/components/BotoesOAuth";

/** Moldura das páginas de entrar/cadastrar: quem já está logado segue direto. */
export function PaginaConta({
  titulo,
  subtitulo,
  searchParams,
  formulario,
}: {
  titulo: string;
  subtitulo: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  formulario: (voltar: string) => ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md px-4 pt-16 sm:px-6">
      <h1 className="text-center font-serif text-4xl font-semibold tracking-tight">{titulo}</h1>
      <p className="mt-2 text-center text-suave">{subtitulo}</p>
      <div className="cartao mt-8 p-6 sm:p-8">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-papel" />}>
          <Conteudo searchParams={searchParams} formulario={formulario} />
        </Suspense>
      </div>
    </div>
  );
}

async function Conteudo({
  searchParams,
  formulario,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  formulario: (voltar: string) => ReactNode;
}) {
  const voltar = caminhoSeguro((await searchParams).voltar);
  if (await usuarioAtual()) redirect(voltar);
  
  return (
    <div className="flex flex-col gap-6">
      {/* Aqui entra o FormEntrar ou FormCadastro nativo */}
      {formulario(voltar)}

      {/* Divisor Visual */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-papel px-2 text-suave">Ou continue com</span>
        </div>
      </div>

      {/* Seu novo Client Component com os botões sociais */}
      <BotoesOAuth />
    </div>
  );
}