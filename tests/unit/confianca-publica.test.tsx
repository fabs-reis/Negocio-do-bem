import { renderToReadableStream, renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Participar from "@/app/participar/page";
import { SeloStatus } from "@/components/SeloStatus";

vi.mock("@/lib/auth/sessao", () => ({ usuarioAtual: async () => null }));
vi.mock("@/lib/db", () => ({ db: { empresa: { findMany: async () => [] } } }));
vi.mock("@/lib/consultas", () => ({
  NO_DIRETORIO: {},
  resumoDoDiretorio: async () => ({ total: 0, cidades: 0 }),
}));
vi.mock("@/lib/instagram", () => ({
  perfilOficial: () => null,
  linkPerfil: (usuario: string) => `https://www.instagram.com/${usuario}/`,
  normalizarUsername: () => null,
}));
vi.mock("@/lib/seo", () => ({ metadadosDaPagina: () => ({}) }));
vi.mock("@/app/participar/CadastroPorEtapas", () => ({ CadastroPorEtapas: () => null }));

describe("comunicação pública dos níveis de confiança", () => {
  it("explica o que o selo oficial confirma e o que não certifica", () => {
    const selo = renderToStaticMarkup(<SeloStatus status="verificada" oficial />);

    expect(selo).toContain("Perfil oficial");
    expect(selo).toContain("O controle da conta do Instagram do negócio foi confirmado.");
    expect(selo).toContain("Isso não certifica a identidade legal nem as causas do negócio.");
    expect(selo).not.toContain("Perfil assumido");
  });

  it("não apresenta um perfil apenas assumido como oficial", () => {
    const selo = renderToStaticMarkup(<SeloStatus status="verificada" oficial={false} />);

    expect(selo).toContain("Perfil assumido");
    expect(selo).toContain("O selo não certifica a identidade nem as causas do negócio.");
    expect(selo).not.toContain("Perfil oficial");
    expect(selo).not.toContain("O controle da conta do Instagram");
  });

  it.each([false, true])("um perfil indicado não recebe selo oficial, mesmo com oficial=%s", (oficial) => {
    const selo = renderToStaticMarkup(<SeloStatus status="indicada" oficial={oficial} />);

    expect(selo).toContain("Indicado pela comunidade");
    expect(selo).not.toContain("Perfil oficial");
    expect(selo).not.toContain("Perfil assumido");
  });

  it("explica o acesso e a confirmação separada no conteúdo renderizado de /participar", async () => {
    const pagina = await renderToReadableStream(<Participar params={Promise.resolve({})} searchParams={Promise.resolve({})} />);
    await pagina.allReady;
    const html = await new Response(pagina).text();

    expect(html).toContain("Você pode editar o perfil.");
    expect(html).toContain("Após assumir o perfil, você pode editar os dados e ocultar o negócio no painel");
    expect(html).toContain("respeitando as regras de moderação.");
    expect(html).toContain("A moderação pode retirar perfis falsos do ar. As decisões tomadas ficam registradas.");
    expect(html).toContain("A confirmação pelo Instagram é um processo separado.");
    expect(html).not.toContain("O perfil é seu.");
    expect(html).not.toContain("confirme que ele é seu.");
  });
});
