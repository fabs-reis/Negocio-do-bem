import { temInstagram } from "@/lib/endereco";
import { linkPerfil } from "@/lib/instagram";

/** O @ do negócio com o link do perfil no Instagram, ou "sem Instagram" para quem não tem. */
export function LinkInstagram({ endereco, seta = false }: { endereco: string; seta?: boolean }) {
  if (!temInstagram(endereco)) return <span>sem Instagram</span>;
  return (
    <a href={linkPerfil(endereco)} target="_blank" rel="noopener noreferrer" className="link">
      @{endereco}
      {seta && " ↗"}
    </a>
  );
}
