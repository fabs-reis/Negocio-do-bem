import { afterEach, describe, expect, it, vi } from "vitest";
import { del, put } from "@vercel/blob";

vi.mock("@vercel/blob", () => ({
  put: vi.fn(async () => ({ url: "https://sintetico.public.blob.vercel-storage.com/perfis/prova.jpg" })),
  del: vi.fn(async () => {}),
}));
vi.mock("node:fs/promises", () => ({ mkdir: vi.fn(), unlink: vi.fn(), writeFile: vi.fn() }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("isolamento do armazenamento dos testes", () => {
  it.each(["BLOB_STORE_ID", "BLOB_READ_WRITE_TOKEN"])("remove o seletor herdado %s antes da prova", async (variavel) => {
    vi.stubEnv("BLOB_STORE_ID", "");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv(variavel, "seletor-sintetico");
    vi.stubEnv("NODE_ENV", "test");
    vi.resetModules();
    await import("../setup");
    const { guardarFoto, apagarFoto } = await import("@/lib/armazenamento");
    const foto = { arquivo: new File([new Uint8Array([0xff, 0xd8, 0xff])], "prova.jpg"), tipo: "image/jpeg" as const };

    const url = await guardarFoto(foto, "perfis");
    await apagarFoto(url);

    expect(put).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
    expect(url).toMatch(/^\/enviados\/perfis\//);
  });
});
