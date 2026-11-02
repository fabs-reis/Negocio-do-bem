import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EmpresaCard } from "@/components/EmpresaCard";

const negocio = {
  instagramUsername: "padaria-recife",
  nome: "Padaria Recife",
  fotoUrl: null,
  resumo: "Pães da comunidade",
  categoria: "Padaria",
  cidade: "Recife",
  uf: "PE",
  status: "indicada",
  causas: [],
  _count: { depoimentos: 0 },
  recomendacao: { motivo: "Pães feitos com cuidado", indicadoPor: "Ana" },
};

describe("cartão do negócio", () => {
  it("preserva o endereço sem apresentá-lo como Instagram e mostra a recomendação", () => {
    const html = renderToStaticMarkup(<EmpresaCard empresa={negocio} />);
    expect(html).toContain('href="/empresas/padaria-recife"');
    expect(html).not.toContain("@padaria-recife");
    expect(html).toContain("Pães feitos com cuidado");
    expect(html).toContain("Ana");
  });

  it("identifica o Instagram quando o endereço é um usuário", () => {
    const html = renderToStaticMarkup(<EmpresaCard empresa={{ ...negocio, instagramUsername: "padaria.recife" }} />);
    expect(html).toContain('href="/empresas/padaria.recife"');
    expect(html).toContain("@padaria.recife");
  });
});
