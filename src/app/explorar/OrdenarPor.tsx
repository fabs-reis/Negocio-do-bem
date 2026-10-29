"use client";

import { useRouter } from "next/navigation";
import { ORDENS, type Ordem } from "@/lib/diretorio";

/** Seletor de ordenação: cada opção já vem com o link do diretório reordenado. */
export function OrdenarPor({ atual, links }: { atual: Ordem; links: Record<Ordem, string> }) {
  const router = useRouter();
  return (
    <label className="inline-flex items-center gap-2 text-sm text-suave">
      Ordenar
      <select
        value={atual}
        onChange={(evento) => router.push(links[evento.target.value as Ordem], { scroll: false })}
        className="rounded-full border border-linha bg-superficie py-2 pr-8 pl-3 text-sm font-medium text-tinta"
      >
        {(Object.keys(ORDENS) as Ordem[]).map((ordem) => (
          <option key={ordem} value={ordem}>
            {ORDENS[ordem]}
          </option>
        ))}
      </select>
    </label>
  );
}
