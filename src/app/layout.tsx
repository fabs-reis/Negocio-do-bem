import "@fontsource-variable/inter";
import "@fontsource-variable/newsreader";
import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { MenuUsuario } from "@/components/MenuUsuario";
import { REPOSITORIO } from "@/lib/dominio";

export const metadata: Metadata = {
  title: {
    default: "Negócio do Bem — compre de quem faz o bem",
    template: "%s · Negócio do Bem",
  },
  description:
    "Um diretório de negócios com consciência social e conexão com a comunidade. Encontre, indique e fortaleça quem compartilha dos seus valores.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-30 border-b border-linha/70 bg-papel/85 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
            <Link href="/" className="shrink-0" aria-label="Negócio do Bem — início">
              <Logo />
            </Link>
            <nav className="flex items-center gap-1 text-sm font-medium sm:gap-2">
              <Link href="/#diretorio" className="hidden rounded-full px-3 py-2 text-suave transition hover:text-tinta sm:block">
                Explorar
              </Link>
              <Link href="/sobre" className="hidden rounded-full px-3 py-2 text-suave transition hover:text-tinta sm:block">
                Como funciona
              </Link>
              <Link href="/indicar" className="rounded-full px-3 py-2 text-suave transition hover:text-tinta">
                Indicar
              </Link>
              <Suspense fallback={<div className="h-9 w-20 rounded-full bg-linha/60" />}>
                <MenuUsuario />
              </Suspense>
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="mt-24 border-t border-linha">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 text-sm text-suave sm:grid-cols-[2fr_1fr_1fr] sm:px-6">
            <div className="space-y-3">
              <Logo />
              <p className="max-w-sm leading-relaxed">
                Um movimento independente para fortalecer negócios que cuidam das pessoas, da comunidade e do planeta.
                Feito pela comunidade, para a comunidade.
              </p>
              <a href={REPOSITORIO} target="_blank" rel="noopener noreferrer" className="link inline-block">
                Código aberto no GitHub ↗
              </a>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-tinta">Comunidade</p>
              <Link href="/#diretorio" className="block hover:text-tinta">Explorar negócios</Link>
              <Link href="/indicar" className="block hover:text-tinta">Indicar um negócio</Link>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-tinta">Para negócios</p>
              <Link href="/sobre#dono" className="block hover:text-tinta">Reivindicar meu perfil</Link>
              <Link href="/sobre#privacidade" className="block hover:text-tinta">Privacidade e remoção</Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
