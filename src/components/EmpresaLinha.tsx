import { EmpresaCard, type EmpresaResumo } from "@/components/EmpresaCard";

/** O mesmo guia em uma apresentação mais compacta, sem esconder as causas. */
export function EmpresaLinha({ empresa }: { empresa: EmpresaResumo }) {
  return <EmpresaCard empresa={empresa} compacta />;
}
