import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AvisoDaUrl } from "@/components/Avisos";
import { caminhoSeguro, usuarioAtual } from "@/lib/auth/sessao";

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
  const parametros = await searchParams;
  const voltar = caminhoSeguro(parametros.voltar);
  if (await usuarioAtual()) redirect(voltar);
  return (
    <>
      {parametros.aviso && (
        <div className="mb-4">
          <AvisoDaUrl codigo={parametros.aviso} />
        </div>
      )}
      {formulario(voltar)}
    </>
  );
}
