"use client";

import { useState, useSyncExternalStore } from "react";
import { abertoComoApp, ehAparelhoApple } from "@/lib/app";
import { enviarEvento } from "@/lib/medicao";

// O Chrome e o Edge (Android e computador) avisam que o site pode ser instalado
// com o evento beforeinstallprompt, que abre a janela de instalação quando a
// pessoa pede. O Safari não tem esse evento: no iPhone, mostramos o caminho
// pelo menu Compartilhar. Nos outros navegadores, o convite não aparece.

type PedidoDeInstalacao = Event & { prompt: () => Promise<void> };

/** O que dá para oferecer: nada, o botão do navegador ou o passo a passo do iPhone. */
type Situacao = "nada" | "botao" | "iphone";

const CHAVE_DISPENSADO = "convite-app-dispensado";

const PASSOS_NO_IPHONE =
  "Toque em Compartilhar (o quadrado com a seta para cima; em algumas versões, ele fica no botão •••) e depois em “Adicionar à Tela de Início”.";

let pedido: PedidoDeInstalacao | null = null;
const ouvintes = new Set<() => void>();

function avisar() {
  ouvintes.forEach((ouvinte) => ouvinte());
}

// Fora do componente, porque o navegador pode mandar o evento antes de a página hidratar.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (evento) => {
    pedido = evento as PedidoDeInstalacao;
    avisar();
  });
  window.addEventListener("appinstalled", () => {
    pedido = null;
    avisar();
    enviarEvento("app_instalado", {});
  });
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

function situacao(): Situacao {
  if (abertoComoApp()) return "nada";
  if (pedido) return "botao";
  return ehAparelhoApple() ? "iphone" : "nada";
}

function dispensado(): boolean {
  try {
    return localStorage.getItem(CHAVE_DISPENSADO) === "sim";
  } catch {
    return false;
  }
}

function useSituacao() {
  return useSyncExternalStore(assinar, situacao, () => "nada" as Situacao);
}

async function instalar() {
  const atual = pedido;
  if (!atual) return;
  // Cada evento abre a janela uma vez só. Se a pessoa recusar, o navegador manda outro mais tarde.
  pedido = null;
  avisar();
  await atual.prompt();
}

/** "Instalar o app" no rodapé: abre a janela do navegador ou, no iPhone, mostra o passo a passo. */
export function InstalarApp() {
  const estado = useSituacao();
  const [mostrarPassos, setMostrarPassos] = useState(false);

  if (estado === "botao") {
    return (
      <button type="button" onClick={instalar} className="block hover:text-tinta">
        Instalar o app
      </button>
    );
  }
  if (estado === "iphone") {
    return (
      <div>
        <button
          type="button"
          onClick={() => setMostrarPassos(!mostrarPassos)}
          aria-expanded={mostrarPassos}
          className="block hover:text-tinta"
        >
          Instalar o app
        </button>
        {mostrarPassos && <p className="mt-1 max-w-xs text-xs leading-relaxed">{PASSOS_NO_IPHONE}</p>}
      </div>
    );
  }
  return null;
}

/** Cartão do painel que convida a instalar o app. Some com "Agora não" e quando o app já está instalado. */
export function ConviteParaInstalar({ className = "" }: { className?: string }) {
  const estado = useSituacao();
  const fechado = useSyncExternalStore(assinar, dispensado, () => true);

  function dispensar() {
    try {
      localStorage.setItem(CHAVE_DISPENSADO, "sim");
    } catch {
      // Sem localStorage, o cartão volta na próxima visita.
    }
    avisar();
  }

  if (estado === "nada" || fechado) return null;

  return (
    <div className={`cartao flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between ${className}`}>
      <div>
        <h3 className="font-medium">Use como app</h3>
        <p className="mt-1 text-sm text-suave">
          {estado === "iphone" ? PASSOS_NO_IPHONE : "Seu painel fica a um toque, direto da tela de início."}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        {estado === "botao" && (
          <button type="button" onClick={instalar} className="botao botao-pequeno">
            Instalar
          </button>
        )}
        <button type="button" onClick={dispensar} className="botao-claro botao-pequeno">
          Agora não
        </button>
      </div>
    </div>
  );
}
