import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/armazenamento", () => ({ usaArmazenamentoCloudflare: () => false }));
vi.mock("@/lib/email", () => ({ envioLigado: () => false }));
vi.mock("@/lib/fotos-instagram", () => ({ tokenDasFotos: () => null }));
vi.mock("@/lib/instagram", () => ({
  configLogin: () => null,
  perfilOficial: () => null,
}));
vi.mock("@/lib/seo", () => ({
  ENDERECO_DO_SITE: "http://localhost:34109",
  INDEXAVEL: false,
}));

const ID_SINTETICO = "G-TEST109000";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Analytics sujeito a consentimento", () => {
  it.each([undefined, ID_SINTETICO])(
    "o Sistema informa configuração sem dispensar consentimento com ID %s",
    async (id) => {
      vi.stubEnv("NEXT_PUBLIC_GA_ID", id);
      vi.stubEnv("GOOGLE_SITE_VERIFICATION", undefined);
      vi.stubEnv("BING_SITE_VERIFICATION", undefined);
      vi.resetModules();

      const { integracoes } = await import("@/lib/moderacao/sistema");
      const itens = integracoes().filter((item) => item.nome === "Google Analytics");

      expect(itens).toHaveLength(1);
      expect(itens[0].ligada).toBe(Boolean(id));
      expect(itens[0].ligadaTexto).toMatch(/consentimento/i);
      expect(JSON.stringify(itens)).not.toContain(ID_SINTETICO);
    },
  );

  it.each([
    ["production", undefined],
    ["production", "preview"],
    ["development", undefined],
    ["development", "preview"],
  ] as const)(
    "headers() retira permissões Google em %s / %s",
    async (ambiente, vercel) => {
      vi.stubEnv("NODE_ENV", ambiente);
      vi.stubEnv("DEPLOY_ENV", undefined);
      vi.stubEnv("VERCEL_ENV", vercel);
      vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_URL", undefined);
      vi.stubEnv("NEXT_PUBLIC_GA_ID", ID_SINTETICO);
      vi.resetModules();

      const { default: config } = await import("../../next.config");
      const regras = await config.headers!();
      const global = regras.find((regra) => regra.source === "/:caminho*");
      const politica = global?.headers.find(
        (header) => header.key.toLowerCase() === "content-security-policy",
      )?.value;

      expect(politica).toBeDefined();
      expect(politica).not.toMatch(
        /(?:googletagmanager\.com|google-analytics\.com|analytics\.google\.com)/i,
      );

      const diretivas = new Map(
        politica!.split(";").map((trecho) => {
          const [nome, ...fontes] = trecho.trim().split(/\s+/);
          return [nome, fontes] as const;
        }),
      );

      expect(diretivas.get("script-src")).toEqual(
        expect.arrayContaining(["'self'", "'unsafe-inline'"]),
      );
      expect(diretivas.get("img-src")).toEqual(
        expect.arrayContaining([
          "'self'",
          "data:",
          "blob:",
        ]),
      );
      expect(diretivas.get("connect-src")).toContain("'self'");
      expect(diretivas.get("object-src")).toEqual(["'none'"]);

      if (ambiente === "development") {
        expect(diretivas.get("script-src")).toContain("'unsafe-eval'");
        expect(diretivas.get("connect-src")).toContain("ws:");
      }
      if (vercel === "preview") {
        expect(diretivas.get("script-src")).toContain("https://vercel.live");
        expect(diretivas.get("connect-src")).toContain("wss://ws-us3.pusher.com");
      }
    },
  );

  it.each([
    ["production", "preview", false],
    ["preview", "production", true],
    ["", "preview", true],
    [undefined, "production", false],
  ] as const)(
    "a CSP usa DEPLOY_ENV %s antes de VERCEL_ENV %s",
    async (deploy, vercel, preview) => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("DEPLOY_ENV", deploy);
      vi.stubEnv("VERCEL_ENV", vercel);
      vi.stubEnv("NEXT_PUBLIC_R2_PUBLIC_URL", "https://vercel.live-fotos.example.com");
      vi.resetModules();

      const { default: config } = await import("../../next.config");
      const regras = await config.headers!();
      const politica = regras
        .find((regra) => regra.source === "/:caminho*")
        ?.headers.find((header) => header.key.toLowerCase() === "content-security-policy")?.value;

      expect(politica).toBeDefined();
      const diretivas = new Map(
        politica!.split(";").map((trecho) => {
          const [nome, ...fontes] = trecho.trim().split(/\s+/);
          return [nome, new Set(fontes)] as const;
        }),
      );

      for (const nome of ["script-src", "style-src", "img-src", "font-src", "connect-src", "frame-src"]) {
        expect(diretivas.get(nome)).toBeDefined();
        expect(diretivas.get(nome)!.has("https://vercel.live")).toBe(preview);
      }
      expect(diretivas.get("img-src")!.has("https://vercel.live-fotos.example.com")).toBe(true);
      expect(diretivas.get("img-src")!.has("https://vercel.com")).toBe(preview);
      expect(diretivas.get("font-src")!.has("https://assets.vercel.com")).toBe(preview);
      expect(diretivas.get("connect-src")!.has("wss://ws-us3.pusher.com")).toBe(preview);
    },
  );
});
