import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { recentesComFoto } from "@/lib/consultas";
import { tintaDoNegocio } from "@/lib/cortejo";
import { db } from "@/lib/db";
import { textoDeBusca } from "@/lib/texto";

async function limparBanco() {
  await db.$executeRawUnsafe(
    `TRUNCATE "RegistroAuditoria", "Depoimento", "Reivindicacao", "EmpresaMembro", "EmpresaCausa", "Empresa", "Sessao", "Usuario" CASCADE`,
  );
}

let indicadora: { id: string };
let dono: { id: string };

/** Um negócio do diretório com foto do site, criado no dia `dia` de outubro (quanto maior, mais recente). */
async function criarEmpresa(
  username: string,
  dia: number,
  dados: {
    historia?: string;
    motivoIndicacao?: string | null;
    fotoUrl?: string | null;
    moderacao?: string;
    oculta?: boolean;
    causas?: string[];
    instagramUserId?: string;
    instagramIgsid?: string;
    comDono?: boolean;
  } = {},
) {
  const { causas = [], comDono = false, ...resto } = dados;
  const campos = { nome: `Negócio ${username}`, resumo: `Resumo de ${username}`, categoria: "Café e padaria", cidade: "Recife", uf: "PE" };
  return db.empresa.create({
    data: {
      instagramUsername: username,
      moderacao: "aprovada",
      fotoUrl: `/enviados/${username}.jpg`,
      motivoIndicacao: "Atendimento muito acolhedor.",
      indicadaPorId: indicadora.id,
      criadoEm: new Date(Date.UTC(2026, 9, dia)),
      ...campos,
      ...resto,
      busca: textoDeBusca({ ...campos, instagramUsername: username }),
      causas: { create: causas.map((causa) => ({ causa })) },
      ...(comDono ? { membros: { create: { usuarioId: dono.id } } } : {}),
    },
  });
}

beforeEach(async () => {
  await limparBanco();
  indicadora = await db.usuario.create({ data: { nome: "Ana Indicadora", email: "ana@exemplo.com", senhaHash: "scrypt$segredo" } });
  dono = await db.usuario.create({ data: { nome: "Bruno Dono", email: "bruno@exemplo.com", senhaHash: "scrypt$segredo" } });

  // No diretório, sem história: a indicação aparece.
  await criarEmpresa("sem.historia", 10, {
    historia: "  \n ",
    motivoIndicacao: "Pão de fermentação natural e gente muito boa.",
    causas: ["sustentavel", "antirracista"],
    instagramUserId: "17841400000000001",
    instagramIgsid: "igsid-secreto-1",
  });
  // No diretório, com história escrita pelo dono: aparece, sem a indicação.
  await criarEmpresa("com.historia", 12, {
    historia: "Começamos em 2019, no quintal de casa.",
    motivoIndicacao: "Motivo que não pode aparecer.",
    comDono: true,
    instagramUserId: "17841400000000002",
  });
  // Fora da lista: escondido pelo dono, tirado do ar e ainda pendente.
  await criarEmpresa("escondido", 14, { oculta: true });
  await criarEmpresa("tirado.do.ar", 15, { moderacao: "rejeitada" });
  await criarEmpresa("pendente", 16, { moderacao: "pendente" });
  // Fora da lista: no diretório, mas sem foto do site.
  await criarEmpresa("sem.foto", 17, { fotoUrl: null });
  await criarEmpresa("foto.vazia", 18, { fotoUrl: "" });
  await criarEmpresa("foto.de.fora", 19, { fotoUrl: "https://exemplo.com/foto.jpg" });
});

afterAll(async () => {
  await limparBanco();
  await db.$disconnect();
});

describe("recentesComFoto", () => {
  it("traz só os negócios do diretório com foto do site, os mais recentes primeiro", async () => {
    const recentes = await recentesComFoto(6);
    expect(recentes.map((r) => r.instagramUsername)).toEqual(["com.historia", "sem.historia"]);
  });

  it("mostra a indicação e quem indicou só quando não há história", async () => {
    const [comHistoria, semHistoria] = await recentesComFoto(6);
    expect(semHistoria).toEqual({
      instagramUsername: "sem.historia",
      nome: "Negócio sem.historia",
      cidade: "Recife",
      uf: "PE",
      fotoUrl: "/enviados/sem.historia.jpg",
      resumo: "Resumo de sem.historia",
      causas: ["antirracista", "sustentavel"],
      tinta: tintaDoNegocio("sem.historia"),
      recomendacao: { motivo: "Pão de fermentação natural e gente muito boa.", indicadoPor: "Ana Indicadora" },
    });
    expect(comHistoria!.instagramUsername).toBe("com.historia");
    expect(comHistoria!.recomendacao).toBeNull();
  });

  it("devolve só os campos públicos", async () => {
    const recentes = await recentesComFoto(6);
    for (const r of recentes) {
      expect(Object.keys(r).sort()).toEqual(
        ["causas", "cidade", "fotoUrl", "instagramUsername", "nome", "recomendacao", "resumo", "tinta", "uf"].sort(),
      );
    }
    const texto = JSON.stringify(recentes);
    for (const privado of [
      "17841400000000001",
      "17841400000000002",
      "igsid-secreto-1",
      indicadora.id,
      dono.id,
      "Bruno Dono",
      "Começamos em 2019",
      "Motivo que não pode aparecer",
    ]) {
      expect(texto).not.toContain(privado);
    }
  });

  it("respeita o limite e completa a lista quando um recente não tem foto do site", async () => {
    expect((await recentesComFoto(1)).map((r) => r.instagramUsername)).toEqual(["com.historia"]);
    // O mais recente de todos tem foto de outro site: a lista de 2 continua com 2.
    await criarEmpresa("ainda.mais.recente", 20, { fotoUrl: "https://exemplo.com/outra.jpg" });
    await criarEmpresa("antigo", 2);
    expect((await recentesComFoto(2)).map((r) => r.instagramUsername)).toEqual(["com.historia", "sem.historia"]);
    expect((await recentesComFoto(3)).map((r) => r.instagramUsername)).toEqual(["com.historia", "sem.historia", "antigo"]);
    expect(await recentesComFoto(0)).toEqual([]);
  });
});
