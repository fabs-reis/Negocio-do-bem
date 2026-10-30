import { tintaDoNegocio, type Tinta } from "@/lib/cortejo";
import { iniciais } from "@/lib/texto";

// O fundo usa a tinta do negócio. As letras usam `sobre-<tinta>`.
const CORES: Record<Tinta, string> = {
  azul: "bg-[color:var(--color-azul,#2f63c8)] text-[color:var(--color-sobre-azul,#fffaf2)]",
  rosa: "bg-[color:var(--color-rosa,#d27ea0)] text-[color:var(--color-sobre-rosa,#1e1a16)]",
  amarelo: "bg-[color:var(--color-amarelo,#f2c230)] text-[color:var(--color-sobre-amarelo,#1e1a16)]",
  verde: "bg-[color:var(--color-verde,#3f9a5c)] text-[color:var(--color-sobre-verde,#1e1a16)]",
  terracota: "bg-[color:var(--color-terracota,#b4502c)] text-[color:var(--color-sobre-terracota,#fffaf2)]",
};

export function Monograma({ nome, chave, tamanho = "md" }: { nome: string; chave: string; tamanho?: "md" | "lg" }) {
  const dimensoes = tamanho === "lg" ? "h-24 w-24 text-3xl ring-4" : "h-12 w-12 text-base ring-2";
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full font-serif font-semibold ring-superficie ${dimensoes} ${CORES[tintaDoNegocio(chave)]}`}
    >
      {iniciais(nome)}
    </span>
  );
}
