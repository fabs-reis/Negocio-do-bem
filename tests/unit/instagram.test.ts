import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { extrairCodigo, gerarCodigo } from "@/lib/codigo";
import { assinaturaValida, extrairMensagens, normalizarUsername, perfilOficial, urlAutorizacao } from "@/lib/instagram";

describe("normalizarUsername", () => {
  it.each([
    ["padariaflor", "padariaflor"],
    ["@PadariaFlor", "padariaflor"],
    ["  @@casa.do_bem ", "casa.do_bem"],
    ["https://www.instagram.com/casa.do_bem/", "casa.do_bem"],
    ["instagram.com/casadobem?igsh=abc123", "casadobem"],
  ])("aceita %j", (entrada, esperado) => {
    expect(normalizarUsername(entrada)).toBe(esperado);
  });

  it.each(["", "@", "com espaço", "acentuação", ".comeca", "termina.", "dois..pontos", "a".repeat(31), "https://instagram.com/p/abc"])(
    "rejeita %j",
    (entrada) => {
      expect(normalizarUsername(entrada)).toBeNull();
    },
  );

  it("rejeita o que não é texto", () => {
    expect(normalizarUsername(undefined)).toBeNull();
    expect(normalizarUsername(123)).toBeNull();
  });
});

describe("código de verificação", () => {
  it("gera no formato BEM-XXXXXX sem caracteres ambíguos", () => {
    for (let i = 0; i < 200; i++) {
      expect(gerarCodigo()).toMatch(/^BEM-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });

  it("acha o código mesmo escrito de outro jeito", () => {
    expect(extrairCodigo("Oi! Meu código é BEM-7K3F9Q")).toBe("BEM-7K3F9Q");
    expect(extrairCodigo("bem 7k3f9q")).toBe("BEM-7K3F9Q");
    expect(extrairCodigo("BEM7K3F9Q obrigado")).toBe("BEM-7K3F9Q");
    expect(extrairCodigo("tudo bem? quero cadastrar")).toBeNull();
  });
});

describe("assinaturaValida", () => {
  const segredo = "segredo-do-app";
  const corpo = JSON.stringify({ object: "instagram", entry: [] });
  const assinatura = `sha256=${createHmac("sha256", segredo).update(corpo).digest("hex")}`;

  it("aceita a assinatura correta", () => {
    expect(assinaturaValida(corpo, assinatura, segredo)).toBe(true);
  });

  it("rejeita assinatura ausente, errada ou de outro corpo", () => {
    expect(assinaturaValida(corpo, null, segredo)).toBe(false);
    expect(assinaturaValida(corpo, "sha256=abc", segredo)).toBe(false);
    expect(assinaturaValida(corpo + " ", assinatura, segredo)).toBe(false);
    expect(assinaturaValida(corpo, assinatura, "outro-segredo")).toBe(false);
  });
});

describe("extrairMensagens", () => {
  it("lê DMs de texto e ignora ecos e eventos sem texto", () => {
    const payload = {
      object: "instagram",
      entry: [
        {
          id: "17841400000000000",
          time: 1761650000,
          messaging: [
            { sender: { id: "111" }, recipient: { id: "999" }, message: { mid: "m1", text: "BEM-7K3F9Q" } },
            { sender: { id: "999" }, recipient: { id: "111" }, message: { mid: "m2", text: "Recebido!", is_echo: true } },
            { sender: { id: "222" }, recipient: { id: "999" }, message: { mid: "m3", attachments: [] } },
            { sender: { id: "333" }, recipient: { id: "999" }, read: { mid: "m1" } },
          ],
        },
      ],
    };
    expect(extrairMensagens(payload)).toEqual([{ remetenteId: "111", texto: "BEM-7K3F9Q" }]);
  });

  it("não quebra com payload inesperado", () => {
    expect(extrairMensagens(null)).toEqual([]);
    expect(extrairMensagens({ entry: "x" })).toEqual([]);
    expect(extrairMensagens({ entry: [{ messaging: [null, 1, "a"] }] })).toEqual([]);
  });
});

describe("urlAutorizacao", () => {
  it("pede só a permissão básica e repassa o estado", () => {
    const url = new URL(
      urlAutorizacao({ appId: "123", appSecret: "s", redirectUri: "https://site.org/api/instagram/retorno" }, "estado-1"),
    );
    expect(url.origin + url.pathname).toBe("https://www.instagram.com/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("123");
    expect(url.searchParams.get("redirect_uri")).toBe("https://site.org/api/instagram/retorno");
    expect(url.searchParams.get("scope")).toBe("instagram_business_basic");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("estado-1");
  });
});

describe("perfilOficial", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sem a variável, é o perfil do projeto, e o código por DM já vem ligado", () => {
    vi.stubEnv("INSTAGRAM_PERFIL_OFICIAL", undefined);
    expect(perfilOficial()).toBe("ofabsreis");
    // O .env.example traz a variável vazia.
    vi.stubEnv("INSTAGRAM_PERFIL_OFICIAL", "");
    expect(perfilOficial()).toBe("ofabsreis");
  });

  it("a variável troca o perfil", () => {
    vi.stubEnv("INSTAGRAM_PERFIL_OFICIAL", "@Outro.Perfil");
    expect(perfilOficial()).toBe("outro.perfil");
  });
});
