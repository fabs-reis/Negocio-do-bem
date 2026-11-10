"use client";

import { useState, type ReactNode } from "react";

type Aba = { id: string; rotulo: string; conteudo: ReactNode };

/**
 * As abas de "Os mais queridos" na página inicial. As duas listas já vêm prontas do
 * servidor; a aba só escolhe qual aparece. Sem JavaScript, fica a primeira.
 */
export function AbasDoRanking({ abas }: { abas: Aba[] }) {
  const [ativa, setAtiva] = useState(abas[0]?.id);
  if (abas.length === 0) return null;
  return (
    <div className="flex flex-col gap-6">
      {abas.length > 1 && (
        <div role="tablist" aria-label="Ordenar os mais queridos" className="flex self-start rounded-full bg-areia p-1 max-sm:w-full">
          {abas.map((aba) => (
            <button
              key={aba.id}
              type="button"
              role="tab"
              id={`aba-${aba.id}`}
              aria-selected={aba.id === ativa}
              aria-controls={`painel-${aba.id}`}
              onClick={() => setAtiva(aba.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition max-sm:flex-1 ${
                aba.id === ativa ? "bg-superficie text-tinta shadow-cartao" : "text-suave hover:text-tinta"
              }`}
            >
              {aba.rotulo}
            </button>
          ))}
        </div>
      )}
      {abas.map((aba) => (
        <div key={aba.id} role="tabpanel" id={`painel-${aba.id}`} aria-labelledby={`aba-${aba.id}`} hidden={aba.id !== ativa}>
          {aba.conteudo}
        </div>
      ))}
    </div>
  );
}
