import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { del, list } from "@vercel/blob";
import path from "node:path";
import { removerFoto, salvarEmpresa } from "@/acoes/empresas";
import { apagarFoto, limparFotosHistorias } from "@/lib/armazenamento";
import { exigirUsuario } from "@/lib/auth/sessao";
import { ErroFotoDescartada, validarFotosDaHistoria } from "@/lib/ciclo-fotos";
import { db } from "@/lib/db";

vi.mock("@/lib/auth/sessao", () => ({ exigirUsuario: vi.fn(), caminhoSeguro: (valor: string) => valor }));
const disco = vi.hoisted(() => ({ readdir: vi.fn(), realpath: vi.fn(), lstat: vi.fn(), unlink: vi.fn() }));
vi.mock("node:fs/promises", async (importar) => ({ ...await importar<typeof import("node:fs/promises")>(), ...disco }));

vi.mock("@vercel/blob", () => ({
  put: vi.fn(),
  del: vi.fn(async () => {}),
  list: vi.fn(),
}));

const FOTO = "https://cicloteste.public.blob.vercel-storage.com/historias/aaaaaaaaaaaaaaaaaaaaaaaa.jpg";

async function limparBanco() {
  await db.$executeRawUnsafe(
    `TRUNCATE "RegistroAuditoria", "Depoimento", "Reivindicacao", "EmpresaMembro", "EmpresaCausa", "Empresa", "Sessao", "Usuario" CASCADE`,
  );
}

function criarEmpresa(username: string, historia: string) {
  return db.empresa.create({
    data: {
      instagramUsername: username,
      nome: `Negócio ${username}`,
      resumo: "Um negócio do bem",
      categoria: "Serviços",
      cidade: "Recife",
      uf: "PE",
      moderacao: "aprovada",
      historia,
    },
  });
}

beforeEach(async () => {
  await limparBanco();
  vi.clearAllMocks();
  vi.stubEnv("BLOB_STORE_ID", "ciclo-teste");
  vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
  vi.stubEnv("FOTOS_DOMINIO_EXCLUSIVO", "confirmado");
  disco.readdir.mockResolvedValue([]);
  disco.realpath.mockImplementation(async (destino: string) => destino);
  disco.lstat.mockResolvedValue({ isDirectory: () => true, isFile: () => true });
  disco.unlink.mockResolvedValue(undefined);
  vi.mocked(del).mockResolvedValue();
  vi.mocked(list).mockResolvedValue({
    blobs: [{ url: FOTO, pathname: "historias/aaaaaaaaaaaaaaaaaaaaaaaa.jpg", size: 3, uploadedAt: new Date(), downloadUrl: FOTO, etag: "teste" }],
    hasMore: false,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
afterAll(async () => {
  await limparBanco();
  await db.$disconnect();
});

describe("ciclo das fotos", () => {
  it("não apaga uma foto usada na história de outro negócio", async () => {
    await criarEmpresa("outra.loja", `![Nossa foto](${FOTO})`);

    await apagarFoto(FOTO);

    expect(del).not.toHaveBeenCalled();
  });

  it.each([
    { oculta: true },
    { moderacao: "pendente" },
    { moderacao: "rejeitada" },
  ])("preserva referências mesmo fora do diretório: %j", async (estado) => {
    const empresa = await criarEmpresa("fora.diretorio", `![Foto][imagem]\n\n[imagem]: ${FOTO}?x=1#foto`);
    await db.empresa.update({ where: { id: empresa.id }, data: estado });

    expect(await apagarFoto(FOTO)).toBe("preservada");
    expect(del).not.toHaveBeenCalled();
  });

  it("descarta upload nunca salvo apenas depois do registro durável", async () => {
    vi.mocked(del).mockImplementationOnce(async () => {
      expect(await db.registroAuditoria.count({ where: { acao: "foto.descarte_iniciado", alvoId: FOTO } })).toBe(1);
    });

    expect(await limparFotosHistorias([FOTO], true)).toEqual([{ url: FOTO, status: "descartada" }]);
    expect(del).toHaveBeenCalledExactlyOnceWith(FOTO);
  });

  it("só descarta uma foto retirada quando nenhuma outra história a utiliza", async () => {
    const primeira = await criarEmpresa("primeira.loja", `![Foto](${FOTO})`);
    const segunda = await criarEmpresa("segunda.loja", `![Foto](${FOTO})`);
    await db.empresa.update({ where: { id: primeira.id }, data: { historia: "Sem foto" } });
    expect(await apagarFoto(FOTO)).toBe("preservada");
    await db.empresa.update({ where: { id: segunda.id }, data: { historia: "Sem foto" } });
    expect(await apagarFoto(FOTO)).toBe("descartada");
    expect(del).toHaveBeenCalledTimes(1);
  });

  it("não grava eventos nem exclui no diagnóstico", async () => {
    expect(await limparFotosHistorias()).toEqual([{ url: FOTO, status: "candidata" }]);
    expect(await db.registroAuditoria.count()).toBe(0);
    expect(del).not.toHaveBeenCalled();
  });

  it("bloqueia exclusões enquanto a topologia não estiver confirmada", async () => {
    vi.stubEnv("FOTOS_DOMINIO_EXCLUSIVO", "");
    await expect(limparFotosHistorias([FOTO], true)).rejects.toThrow("exclusão está bloqueada");
    expect(await apagarFoto(FOTO)).toBe("bloqueada");
    expect(list).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
    expect(await db.registroAuditoria.count()).toBe(0);
  });

  it.each([
    FOTO.replace("/historias/", "/perfis/"),
    FOTO.replace("cicloteste.", "outrostore."),
    "/enviados/historias/%2e%2e/perfis/aaaaaaaaaaaaaaaaaaaaaaaa.jpg",
  ])("não exclui seleção fora do inventário: %s", async (url) => {
    await expect(limparFotosHistorias([url], true)).rejects.toThrow("fora do inventário");
    expect(del).not.toHaveBeenCalled();
  });

  it("não trata falta de inventário como autorização para exclusão", async () => {
    vi.mocked(list).mockRejectedValueOnce(new Error("Falha simulada de inventário"));
    await expect(limparFotosHistorias([FOTO], true)).rejects.toThrow("Falha simulada");
    expect(del).not.toHaveBeenCalled();
  });

  it("exige seleção explícita antes de aplicar", async () => {
    await expect(limparFotosHistorias([], true)).rejects.toThrow("Escolha explicitamente");
    expect(del).not.toHaveBeenCalled();
  });

  it("percorre as páginas do inventário", async () => {
    vi.mocked(list)
      .mockResolvedValueOnce({ blobs: [], hasMore: true, cursor: "segunda-pagina" })
      .mockResolvedValueOnce({ blobs: [{ url: FOTO, pathname: "historias/aaaaaaaaaaaaaaaaaaaaaaaa.jpg", size: 3, uploadedAt: new Date(), downloadUrl: FOTO, etag: "teste" }], hasMore: false });
    expect(await limparFotosHistorias()).toEqual([{ url: FOTO, status: "candidata" }]);
    expect(list).toHaveBeenNthCalledWith(2, { prefix: "historias/", cursor: "segunda-pagina" });
  });

  it("não exclui se a escrita do registro falhar", async () => {
    await db.$executeRawUnsafe(`CREATE FUNCTION falhar_descarte_item9() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'falha simulada de auditoria'; END $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER falhar_descarte_item9 BEFORE INSERT ON "RegistroAuditoria" FOR EACH ROW EXECUTE FUNCTION falhar_descarte_item9()`);
    try {
      await expect(limparFotosHistorias([FOTO], true)).rejects.toThrow();
      expect(del).not.toHaveBeenCalled();
      expect(await db.registroAuditoria.count()).toBe(0);
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER falhar_descarte_item9 ON "RegistroAuditoria"`);
      await db.$executeRawUnsafe(`DROP FUNCTION falhar_descarte_item9()`);
    }
  });

  it("mantém a marca depois de uma exclusão incerta e permite repetir o descarte", async () => {
    vi.mocked(del).mockRejectedValueOnce(new Error("Resposta perdida depois do envio"));
    expect(await limparFotosHistorias([FOTO], true)).toEqual([{ url: FOTO, status: "falha" }]);
    await expect(db.$transaction((tx) => validarFotosDaHistoria(tx, `![Foto](${FOTO})`))).rejects.toBeInstanceOf(ErroFotoDescartada);
    expect(await limparFotosHistorias([FOTO], true)).toEqual([{ url: FOTO, status: "descartada" }]);
    expect(await db.registroAuditoria.count({ where: { acao: "foto.descarte_iniciado", alvoId: FOTO } })).toBe(1);
  });

  it("recusa a URL descartada na ação sem perder o texto enviado", async () => {
    const empresa = await criarEmpresa("dona.loja", "História anterior");
    const usuario = await db.usuario.create({ data: { nome: "Pessoa de teste", email: "foto-item9@example.test", senhaHash: "hash-sintetico" } });
    await db.empresaMembro.create({ data: { empresaId: empresa.id, usuarioId: usuario.id, papel: "dono" } });
    vi.mocked(exigirUsuario).mockResolvedValue({ ...usuario, moderador: false });
    await limparFotosHistorias([FOTO], true);
    const historia = `Meu texto continua aqui. ![Foto](${FOTO})`;
    const dados = new FormData();
    for (const [campo, valor] of Object.entries({ empresaId: empresa.id, nome: empresa.nome, categoria: empresa.categoria, municipio: "Recife, PE", resumo: empresa.resumo, historia, site: "", whatsapp: "", emailContato: "" })) dados.set(campo, valor);

    expect(await salvarEmpresa(undefined, dados)).toMatchObject({
      erros: { historia: expect.stringContaining("entrou em descarte") },
      valores: { historia },
    });
    expect((await db.empresa.findUniqueOrThrow({ where: { id: empresa.id } })).historia).toBe("História anterior");
  });

  it("a remoção de perfil preserva a foto que outra história utiliza", async () => {
    const perfil = FOTO.replace("/historias/", "/perfis/");
    const empresa = await criarEmpresa("perfil.dono", "");
    await db.empresa.update({ where: { id: empresa.id }, data: { fotoUrl: perfil } });
    await criarEmpresa("historia.compartilhada", `![Foto](${perfil})`);
    const usuario = await db.usuario.create({ data: { nome: "Pessoa de teste", email: "perfil-item9@example.test", senhaHash: "hash-sintetico" } });
    await db.empresaMembro.create({ data: { empresaId: empresa.id, usuarioId: usuario.id, papel: "dono" } });
    vi.mocked(exigirUsuario).mockResolvedValue({ ...usuario, moderador: false });
    vi.mocked(list).mockResolvedValue({ blobs: [{ url: perfil, pathname: "perfis/aaaaaaaaaaaaaaaaaaaaaaaa.jpg", size: 3, uploadedAt: new Date(), downloadUrl: perfil, etag: "teste" }], hasMore: false });
    const dados = new FormData();
    dados.set("empresaId", empresa.id);

    await expect(removerFoto(dados)).rejects.toThrow("NEXT_REDIRECT");
    expect((await db.empresa.findUniqueOrThrow({ where: { id: empresa.id } })).fotoUrl).toBeNull();
    expect(del).not.toHaveBeenCalled();
  });

  it("preserva a foto que ainda é usada como perfil", async () => {
    const empresa = await criarEmpresa("perfil.atual", "");
    await db.empresa.update({ where: { id: empresa.id }, data: { fotoUrl: FOTO } });
    expect(await apagarFoto(FOTO)).toBe("preservada");
    expect(del).not.toHaveBeenCalled();
  });

  it("não exclui quando o banco falha antes de decidir o descarte", async () => {
    vi.spyOn(db, "$transaction").mockRejectedValueOnce(new Error("Falha simulada de consulta"));
    await expect(limparFotosHistorias([FOTO], true)).rejects.toThrow("Falha simulada");
    expect(del).not.toHaveBeenCalled();
  });

  it("ignora links simbólicos no inventário local", async () => {
    vi.stubEnv("BLOB_STORE_ID", "");
    disco.readdir.mockResolvedValue([{ name: "aaaaaaaaaaaaaaaaaaaaaaaa.jpg", isFile: () => false }]);
    expect(await limparFotosHistorias()).toEqual([]);
    expect(disco.unlink).not.toHaveBeenCalled();
  });

  it("não segue uma pasta local que é link simbólico", async () => {
    vi.stubEnv("BLOB_STORE_ID", "");
    disco.realpath.mockResolvedValue(path.join(process.cwd(), ".nott", "fora-do-inventario"));
    expect(await limparFotosHistorias()).toEqual([]);
    expect(disco.readdir).not.toHaveBeenCalled();
    expect(disco.unlink).not.toHaveBeenCalled();
  });

  it("não apaga um link colocado depois do inventário", async () => {
    vi.stubEnv("BLOB_STORE_ID", "");
    disco.readdir.mockResolvedValue([{ name: "aaaaaaaaaaaaaaaaaaaaaaaa.jpg", isFile: () => true }]);
    disco.lstat.mockImplementation(async (destino: string) => ({ isDirectory: () => true, isFile: () => !destino.endsWith(".jpg") }));
    const url = "/enviados/historias/aaaaaaaaaaaaaaaaaaaaaaaa.jpg";
    expect(await limparFotosHistorias([url], true)).toEqual([{ url, status: "falha" }]);
    expect(disco.unlink).not.toHaveBeenCalled();
  });

  it("a ausência depois do inventário confirma o descarte sem liberar a URL", async () => {
    vi.stubEnv("BLOB_STORE_ID", "");
    disco.readdir.mockResolvedValue([{ name: "aaaaaaaaaaaaaaaaaaaaaaaa.jpg", isFile: () => true }]);
    disco.unlink.mockRejectedValueOnce(Object.assign(new Error("Arquivo sintético já ausente"), { code: "ENOENT" }));
    const url = "/enviados/historias/aaaaaaaaaaaaaaaaaaaaaaaa.jpg";
    expect(await limparFotosHistorias([url], true)).toEqual([{ url, status: "descartada" }]);
    await expect(db.$transaction((tx) => validarFotosDaHistoria(tx, `![Foto](${url})`))).rejects.toBeInstanceOf(ErroFotoDescartada);
  });

  it("o salvamento que confirmou primeiro protege a foto da limpeza concorrente", async () => {
    const empresa = await criarEmpresa("corrida.salvar", "");
    const pronto = Promise.withResolvers<void>();
    const liberar = Promise.withResolvers<void>();
    const salvamento = db.$transaction(async (tx) => {
      await validarFotosDaHistoria(tx, `![Foto](${FOTO})`);
      await tx.empresa.update({ where: { id: empresa.id }, data: { historia: `![Foto](${FOTO})` } });
      pronto.resolve();
      await liberar.promise;
    });
    await pronto.promise;
    const limpeza = limparFotosHistorias([FOTO], true);
    try {
      let bloqueada = false;
      for (let tentativa = 0; tentativa < 100 && !bloqueada; tentativa++) {
        const [estado] = await db.$queryRaw<{ bloqueada: boolean }[]>`SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND NOT granted AND database = (SELECT oid FROM pg_database WHERE datname = current_database())) AS bloqueada`;
        bloqueada = estado.bloqueada;
        if (!bloqueada) await new Promise((resolve) => setTimeout(resolve, 5));
      }
      expect(bloqueada).toBe(true);
    } finally {
      liberar.resolve();
      await salvamento;
    }
    expect(await limpeza).toEqual([{ url: FOTO, status: "preservada" }]);
    expect(del).not.toHaveBeenCalled();
  });

  it("o descarte confirmado impede salvar antes da resposta do armazenamento", async () => {
    const empresa = await criarEmpresa("corrida.descartar", "");
    const iniciado = Promise.withResolvers<void>();
    const liberar = Promise.withResolvers<void>();
    vi.mocked(del).mockImplementationOnce(async () => {
      iniciado.resolve();
      await liberar.promise;
    });
    const limpeza = limparFotosHistorias([FOTO], true);
    await iniciado.promise;
    try {
      await expect(db.$transaction(async (tx) => {
        await validarFotosDaHistoria(tx, `![Foto](${FOTO})`);
        await tx.empresa.update({ where: { id: empresa.id }, data: { historia: `![Foto](${FOTO})` } });
      })).rejects.toBeInstanceOf(ErroFotoDescartada);
      expect((await db.empresa.findUniqueOrThrow({ where: { id: empresa.id } })).historia).toBe("");
    } finally {
      liberar.resolve();
    }
    expect(await limpeza).toEqual([{ url: FOTO, status: "descartada" }]);
  });
});
