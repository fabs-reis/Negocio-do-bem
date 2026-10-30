"use client";

import { pausarMovimento, retomarMovimento, useMovimentoPausado } from "./movimento";

/** Botão que pausa e retoma todas as animações da página. O cortejo já traz um; a página pode pôr outro. */
export function ControleMovimento({ className = "cortejo-pausa", oculto = false }: { className?: string; oculto?: boolean }) {
  const pausado = useMovimentoPausado();
  return (
    <button type="button" className={className} hidden={oculto} onClick={pausado ? retomarMovimento : pausarMovimento}>
      <svg viewBox="0 0 14 14" aria-hidden="true" focusable="false">
        {pausado ? (
          <path d="M 3 1.6 L 12.2 7 L 3 12.4 Z" fill="currentColor" />
        ) : (
          <>
            <rect x="2.2" y="1.5" width="3.4" height="11" rx="1" fill="currentColor" />
            <rect x="8.4" y="1.5" width="3.4" height="11" rx="1" fill="currentColor" />
          </>
        )}
      </svg>
      {pausado ? "Retomar animações" : "Pausar animações"}
    </button>
  );
}
