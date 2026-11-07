import { EmpresaCard, type EmpresaResumo } from "@/components/EmpresaCard";
import type { EstadoFavorito } from "@/components/CoracaoFavorito";

/** O mesmo guia em uma apresentação mais compacta, sem esconder as causas. Com `favorito`, mostra o coração. */
export function EmpresaLinha({ empresa, favorito }: { empresa: EmpresaResumo; favorito?: EstadoFavorito }) {
  return <EmpresaCard empresa={empresa} compacta favorito={favorito} />;
}
