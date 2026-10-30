"use client";

import { useState } from "react";

/** A mensagem pronta da DM, com o código, para a moderação copiar e colar no Instagram. */
export function CopiarMensagem({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sem permissão de área de transferência: dá para selecionar o texto.
    }
  }

  return (
    <div className="space-y-2">
      <p className="rounded-xl border border-dashed border-coral/40 bg-superficie p-3 text-sm leading-relaxed whitespace-pre-line select-all">
        {texto}
      </p>
      <button type="button" onClick={copiar} className="botao-claro botao-pequeno">
        {copiado ? "Copiado ✓" : "Copiar mensagem"}
      </button>
    </div>
  );
}
