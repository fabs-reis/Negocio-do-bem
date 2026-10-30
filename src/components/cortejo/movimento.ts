// A pausa das animações da página, escolhida pelo visitante no botão do cortejo.
// Um estado só para a página toda: o cortejo lê com useMovimentoPausado(), e os laços feitos só com CSS
// (letreiro, selo girando) seguem o atributo <html data-movimento="pausado">.
// A escolha fica guardada no navegador do visitante.

import { useSyncExternalStore } from "react";

const CHAVE = "negocio-do-bem:movimento";
const ouvintes = new Set<() => void>();
let pausado: boolean | null = null;

function lerDoNavegador(): boolean {
  try {
    return window.localStorage.getItem(CHAVE) === "pausado";
  } catch {
    return false;
  }
}

function aplicarNoDocumento(valor: boolean) {
  document.documentElement.dataset.movimento = valor ? "pausado" : "rodando";
}

function atual(): boolean {
  if (pausado === null) pausado = lerDoNavegador();
  return pausado;
}

function inscrever(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  aplicarNoDocumento(atual());
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Pausa (true) ou retoma (false) todas as animações que seguem este estado. */
export function definirMovimentoPausado(valor: boolean) {
  pausado = valor;
  try {
    if (valor) window.localStorage.setItem(CHAVE, "pausado");
    else window.localStorage.removeItem(CHAVE);
  } catch {
    // Sem armazenamento (aba anônima, bloqueio): a pausa vale só até sair da página.
  }
  aplicarNoDocumento(valor);
  for (const ouvinte of ouvintes) ouvinte();
}

export function pausarMovimento() {
  definirMovimentoPausado(true);
}

export function retomarMovimento() {
  definirMovimentoPausado(false);
}

/** true quando o visitante pausou as animações. No servidor, sempre false. */
export function useMovimentoPausado(): boolean {
  return useSyncExternalStore(inscrever, atual, () => false);
}

function inscreverNoMovimentoReduzido(ouvinte: () => void) {
  const consulta = window.matchMedia("(prefers-reduced-motion: reduce)");
  consulta.addEventListener("change", ouvinte);
  return () => consulta.removeEventListener("change", ouvinte);
}

/** true quando o sistema pede movimento reduzido. */
export function useMovimentoReduzido(): boolean {
  return useSyncExternalStore(
    inscreverNoMovimentoReduzido,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

function inscreverNaVisibilidade(ouvinte: () => void) {
  document.addEventListener("visibilitychange", ouvinte);
  return () => document.removeEventListener("visibilitychange", ouvinte);
}

/** true enquanto a aba está escondida. */
export function useAbaOculta(): boolean {
  return useSyncExternalStore(
    inscreverNaVisibilidade,
    () => document.visibilityState === "hidden",
    () => false,
  );
}
