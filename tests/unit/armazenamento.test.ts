import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { del, list, put } from "@vercel/blob";
import { apagarFoto, guardarFoto } from "@/lib/armazenamento";

vi.mock("@vercel/blob", () => ({
  put: vi.fn(async (nome: string) => ({ url: `https://abc123.public.blob.vercel-storage.com/${nome}` })),
  del: vi.fn(async () => {}),
  list: vi.fn(),
}));

vi.mock("@/lib/ciclo-fotos", () => ({
  descartarFotos: vi.fn(async (urls: string[], excluir: (url: string) => Promise<void>) => {
    await Promise.all(urls.map(excluir));
    return urls.map((url) => ({ url, status: "descartada" }));
  }),
}));

const FOTO = { arquivo: new File([new Uint8Array([0xff, 0xd8, 0xff])], "foto"), tipo: "image/jpeg" as const };
const URL_BLOB = "https://abc123.public.blob.vercel-storage.com/perfis/aaaaaaaaaaaaaaaaaaaaaaaa.jpg";

beforeEach(() => {
  vi.stubEnv("BLOB_STORE_ID", "");
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
  vi.stubEnv("FOTOS_DOMINIO_EXCLUSIVO", "confirmado");
  vi.mocked(list).mockResolvedValue({
    blobs: [{ url: URL_BLOB, pathname: "perfis/aaaaaaaaaaaaaaaaaaaaaaaa.jpg", size: 3, uploadedAt: new Date(), downloadUrl: URL_BLOB, etag: "teste" }],
    hasMore: false,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("guardarFoto e apagarFoto", () => {
  // No Vercel, o @vercel/blob se autentica pelo OIDC com o BLOB_STORE_ID, sem token.
  it.each(["BLOB_STORE_ID", "BLOB_READ_WRITE_TOKEN"])("usam o Vercel Blob só com %s", async (variavel) => {
    vi.stubEnv(variavel, "valor");

    const url = await guardarFoto(FOTO, "perfis");
    expect(put).toHaveBeenCalledWith(expect.stringMatching(/^perfis\/[0-9a-f]{24}\.jpg$/), FOTO.arquivo, {
      access: "public",
      contentType: "image/jpeg",
    });
    expect(url).toMatch(/^https:\/\/abc123\.public\.blob\.vercel-storage\.com\/perfis\//);

    await apagarFoto(URL_BLOB);
    expect(del).toHaveBeenCalledWith(URL_BLOB);
  });

  it("em produção, sem nenhuma das duas, recusam o Blob", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await expect(guardarFoto(FOTO, "perfis")).rejects.toThrow("Conecte um Vercel Blob");
    await apagarFoto(URL_BLOB);
    expect(put).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });
});
