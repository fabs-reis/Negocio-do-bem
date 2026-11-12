import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/instagram/retorno/route";

const { processar, medir, avisar, depois } = vi.hoisted(() => ({
  processar: vi.fn(),
  medir: vi.fn(),
  avisar: vi.fn(),
  depois: vi.fn(),
}));

vi.mock("next/server", async (original) => ({
  ...await original<typeof import("next/server")>(),
  after: depois,
}));
vi.mock("@/lib/auth/sessao", () => ({ usuarioAtual: async () => ({ id: "usuario-teste" }) }));
vi.mock("@/lib/db", () => ({
  db: { empresa: { findUnique: async () => ({ instagramUsername: "cafe_exemplo" }) } },
}));
vi.mock("@/lib/instagram", () => ({
  COOKIE_ESTADO: "instagram-estado-teste",
  configLogin: () => ({}),
  trocarCodigoPorToken: async () => "token-simulado",
  buscarContaConectada: async () => ({ id: "instagram-teste", username: "cafe_exemplo" }),
}));
vi.mock("@/lib/medicao-servidor", () => ({ medir }));
vi.mock("@/lib/notificacoes", () => ({ avisarNovaReivindicacao: avisar }));
vi.mock("@/lib/reivindicacao", () => ({
  ErroReivindicacao: class extends Error {},
  processarLoginInstagram: processar,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("retorno do Instagram após integrar a stage", () => {
  it.each([
    { consulta: "state=outro-estado&code=codigo-teste", aviso: "ig_erro" },
    { consulta: "state=estado-teste", aviso: "ig_erro" },
    { consulta: "error=access_denied", aviso: "ig_cancelado" },
  ])("não processa um retorno inválido: $consulta", async ({ consulta, aviso }) => {
    const pedido = new NextRequest(`https://exemplo.test/api/instagram/retorno?${consulta}`, {
      headers: { cookie: "instagram-estado-teste=estado-teste.empresa-teste" },
    });

    const resposta = await GET(pedido);
    const destino = new URL(resposta.headers.get("location")!);

    expect(destino.pathname).toBe("/empresas/cafe_exemplo/reivindicar");
    expect(destino.searchParams.get("aviso")).toBe(aviso);
    expect(processar).not.toHaveBeenCalled();
    expect(medir).not.toHaveBeenCalled();
    expect(depois).not.toHaveBeenCalled();
  });

  it.each([
    { tipo: "verificada", caminho: "/empresas/cafe_exemplo", aviso: "verificada" },
    { tipo: "em_analise", caminho: "/empresas/cafe_exemplo/reivindicar", aviso: "em_analise" },
    { tipo: "em_analise_fora_do_ar", caminho: "/painel", aviso: "em_analise" },
  ])("preserva a medição e o destino de $tipo", async ({ tipo, caminho, aviso }) => {
    processar.mockResolvedValue({ tipo });
    const pedido = new NextRequest("https://exemplo.test/api/instagram/retorno?state=estado-teste&code=codigo-teste", {
      headers: { cookie: "instagram-estado-teste=estado-teste.empresa-teste" },
    });

    const resposta = await GET(pedido);
    const destino = new URL(resposta.headers.get("location")!);

    expect(resposta.status).toBe(307);
    expect(destino.pathname).toBe(caminho);
    expect(destino.searchParams.get("aviso")).toBe(aviso);
    expect(medir).toHaveBeenCalledWith({
      nome: "perfil_reivindicado",
      params: { method: "instagram", resultado: aviso },
    });
    expect(resposta.cookies.get("instagram-estado-teste")?.value).toBe("");
    if (aviso === "em_analise") {
      expect(depois).toHaveBeenCalledOnce();
      await depois.mock.calls[0][0]();
      expect(avisar).toHaveBeenCalledWith("empresa-teste");
    } else {
      expect(depois).not.toHaveBeenCalled();
    }
  });
});
