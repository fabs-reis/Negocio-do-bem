import { Monograma } from "@/components/Monograma";
import { tintaDoNegocio, type Tinta } from "@/lib/cortejo";
import { ehFotoDoSite } from "@/lib/fotos";

type EmpresaComFoto = { nome: string; instagramUsername: string; fotoUrl: string | null };
export type EmpresaDaFoto = EmpresaComFoto & { id: string };

/** Só os campos que o FormFoto usa: o resto do registro não vai para o navegador. */
export function fotoDe({ id, nome, instagramUsername, fotoUrl }: EmpresaDaFoto): EmpresaDaFoto {
  return { id, nome, instagramUsername, fotoUrl };
}

// O anel da foto tem a tinta do negócio, a mesma do monograma.
const ANEL: Record<Tinta, string> = {
  azul: "ring-[color:var(--color-azul,#2f63c8)]",
  rosa: "ring-[color:var(--color-rosa,#d27ea0)]",
  amarelo: "ring-[color:var(--color-amarelo,#f2c230)]",
  verde: "ring-[color:var(--color-verde,#3f9a5c)]",
  terracota: "ring-[color:var(--color-terracota,#b4502c)]",
};

/** Foto do negócio; sem foto, o monograma com as iniciais. */
export function FotoEmpresa({ empresa, tamanho = "md" }: { empresa: EmpresaComFoto; tamanho?: "md" | "lg" }) {
  if (!ehFotoDoSite(empresa.fotoUrl)) {
    return <Monograma nome={empresa.nome} chave={empresa.instagramUsername} tamanho={tamanho} />;
  }
  const dimensoes = tamanho === "lg" ? "h-24 w-24 ring-4" : "h-12 w-12 ring-2";
  return (
    // As fotos já chegam reduzidas e quadradas (ver reduzirFoto.ts).
    // eslint-disable-next-line @next/next/no-img-element
    <img src={empresa.fotoUrl} alt="" className={`shrink-0 rounded-full bg-superficie object-cover ${ANEL[tintaDoNegocio(empresa.instagramUsername)]} ${dimensoes}`} />
  );
}
