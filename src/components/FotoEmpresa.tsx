import { Monograma } from "@/components/Monograma";
import { ehFotoDoSite } from "@/lib/fotos";

type EmpresaComFoto = { nome: string; instagramUsername: string; fotoUrl: string | null };
export type EmpresaDaFoto = EmpresaComFoto & { id: string };

/** Só os campos que o FormFoto usa: o resto do registro não vai para o navegador. */
export function fotoDe({ id, nome, instagramUsername, fotoUrl }: EmpresaDaFoto): EmpresaDaFoto {
  return { id, nome, instagramUsername, fotoUrl };
}

/** Foto do negócio; sem foto, o monograma com as iniciais. */
export function FotoEmpresa({ empresa, tamanho = "md" }: { empresa: EmpresaComFoto; tamanho?: "md" | "lg" }) {
  if (!ehFotoDoSite(empresa.fotoUrl)) {
    return <Monograma nome={empresa.nome} chave={empresa.instagramUsername} tamanho={tamanho} />;
  }
  const dimensoes = tamanho === "lg" ? "h-24 w-24 ring-4" : "h-12 w-12 ring-2";
  return (
    // As fotos já chegam reduzidas e quadradas (ver reduzirFoto.ts).
    // eslint-disable-next-line @next/next/no-img-element
    <img src={empresa.fotoUrl} alt="" className={`shrink-0 rounded-full bg-white object-cover ring-white ${dimensoes}`} />
  );
}
