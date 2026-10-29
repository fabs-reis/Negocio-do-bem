import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buscarDiretorio, cidadeDoSlug, cidadesCom, listarParaSitemap, resumoDoDiretorio } from "@/lib/consultas";
import { db } from "@/lib/db";
import { SEM_FILTROS, type FiltrosDiretorio } from "@/lib/diretorio";
import { textoDeBusca } from "@/lib/texto";

async function limparBanco() {
  await db.$executeRawUnsafe(
    `TRUNCATE "RegistroAuditoria", "Depoimento", "Reivindicacao", "EmpresaMembro", "EmpresaCausa", "Empresa", "Sessao", "Usuario" CASCADE`,
  );
}

async function criarEmpresa(
  username: string,
  dados: { nome: string; categoria: string; cidade: string; uf: string; causas?: string[]; status?: string; moderacao?: string; oculta?: boolean },
) {
  const { causas = [], ...resto } = dados;
  const campos = { resumo: "Um negócio do bem", ...resto };
  return db.empresa.create({
    data: {
      instagramUsername: username,
      moderacao: "aprovada",
      ...campos,
      busca: textoDeBusca({ ...campos, instagramUsername: username }),
      causas: { create: causas.map((causa) => ({ causa })) },
    },
  });
}

const filtros = (mudanca: Partial<FiltrosDiretorio>): FiltrosDiretorio => ({ ...SEM_FILTROS, ...mudanca });

beforeEach(async () => {
  await limparBanco();
  await criarEmpresa("padaria.florescer", {
    nome: "Padaria Florescer",
    categoria: "Café e padaria",
    cidade: "Recife",
    uf: "PE",
    status: "verificada",
    causas: ["liderado-por-mulheres", "sustentavel"],
  });
  await criarEmpresa("cafe.arcoiris", { nome: "Café Arco-Íris", categoria: "Café e padaria", cidade: "São Paulo", uf: "SP", causas: ["sustentavel"] });
  await criarEmpresa("atelie.raiz", {
    nome: "Ateliê Raiz Preta",
    categoria: "Moda e acessórios",
    cidade: "Recife",
    uf: "PE",
    status: "verificada",
    causas: ["antirracista"],
  });
  // Fora do diretório: escondido pelo dono e tirado do ar pela moderação.
  await criarEmpresa("escondido", { nome: "Escondido", categoria: "Pet", cidade: "Recife", uf: "PE", oculta: true });
  await criarEmpresa("tirado", { nome: "Tirado do ar", categoria: "Pet", cidade: "Olinda", uf: "PE", moderacao: "rejeitada" });
});

afterAll(async () => {
  await limparBanco();
  await db.$disconnect();
});

describe("resumoDoDiretorio", () => {
  it("conta só os negócios que aparecem no diretório", async () => {
    expect(await resumoDoDiretorio()).toEqual({
      total: 3,
      verificados: 2,
      cidades: 2,
      estados: 2,
      porCategoria: { "Café e padaria": 2, "Moda e acessórios": 1 },
    });
  });
});

describe("buscarDiretorio", () => {
  it("sem filtros, traz todos, os verificados primeiro, e as cidades para o Onde?", async () => {
    const r = await buscarDiretorio(SEM_FILTROS);
    expect(r.total).toBe(3);
    expect(r.itens.at(-1)!.instagramUsername).toBe("cafe.arcoiris");
    expect(r.cidades).toEqual([
      { cidade: "Recife", uf: "PE", total: 2 },
      { cidade: "São Paulo", uf: "SP", total: 1 },
    ]);
  });

  it("filtra por tipo e conta os outros tipos como se aquele filtro não existisse", async () => {
    const r = await buscarDiretorio(filtros({ tipos: ["Café e padaria"] }));
    expect(r.total).toBe(2);
    expect(r.porCategoria).toEqual({ "Café e padaria": 2, "Moda e acessórios": 1 });
    // Entre os 2 resultados: quantos sobram ao marcar cada causa.
    expect(r.porCausa).toEqual({ sustentavel: 2, "liderado-por-mulheres": 1 });
  });

  it("filtra pelo Onde?: cidade com UF, estado ou cidade sem negócios", async () => {
    expect((await buscarDiretorio(filtros({ onde: "Recife, PE" }))).total).toBe(2);
    expect((await buscarDiretorio(filtros({ onde: "sp" }))).total).toBe(1);
    const semNinguem = await buscarDiretorio(filtros({ onde: "Olinda, PE" }));
    expect(semNinguem.total).toBe(0);
    expect(semNinguem.local).toEqual({ cidade: "Olinda", uf: "PE", rotulo: "Olinda, PE" });
  });

  it("combina causas (todas precisam valer), verificados e texto", async () => {
    expect((await buscarDiretorio(filtros({ causas: ["sustentavel", "liderado-por-mulheres"] }))).total).toBe(1);
    const verificados = await buscarDiretorio(filtros({ verificados: true, tipos: ["Café e padaria"] }));
    expect(verificados.total).toBe(1);
    // O número ao lado de "Só verificados" ignora esse próprio filtro.
    expect(verificados.verificados).toBe(1);
    expect((await buscarDiretorio(filtros({ q: "atelie" }))).itens.map((e) => e.instagramUsername)).toEqual(["atelie.raiz"]);
  });

  it("ordena por nome", async () => {
    const r = await buscarDiretorio(filtros({ ordem: "az" }));
    expect(r.itens.map((e) => e.nome)).toEqual(["Ateliê Raiz Preta", "Café Arco-Íris", "Padaria Florescer"]);
  });
});

describe("listarParaSitemap", () => {
  it("lista só os negócios do diretório, do atualizado mais recentemente ao mais antigo", async () => {
    await db.empresa.update({ where: { instagramUsername: "cafe.arcoiris" }, data: { resumo: "Atualizado agora" } });
    const negocios = await listarParaSitemap();
    expect(negocios.map((n) => n.instagramUsername)).toEqual(["cafe.arcoiris", "atelie.raiz", "padaria.florescer"]);
  });
});

describe("páginas de cidade, causa e tipo", () => {
  it("acha a cidade pelo endereço só se ela tem negócios no diretório", async () => {
    expect(await cidadeDoSlug("recife-pe")).toMatchObject({ cidade: "Recife", uf: "PE", total: 2 });
    // Olinda só tem um negócio tirado do ar.
    expect(await cidadeDoSlug("olinda-pe")).toBeUndefined();
    expect(await cidadeDoSlug("recife-sp")).toBeUndefined();
  });

  it("lista as cidades de uma causa e de um tipo, das que têm mais negócios para as que têm menos", async () => {
    expect(await cidadesCom("causa", "sustentavel")).toEqual([
      { cidade: "Recife", uf: "PE", total: 1 },
      { cidade: "São Paulo", uf: "SP", total: 1 },
    ]);
    expect(await cidadesCom("categoria", "Moda e acessórios")).toEqual([{ cidade: "Recife", uf: "PE", total: 1 }]);
    // Os negócios fora do diretório não contam.
    expect(await cidadesCom("categoria", "Pet")).toEqual([]);
  });

  it("junta as grafias da mesma cidade, com o nome da mais usada", async () => {
    await criarEmpresa("brecho.vila", { nome: "Brechó da Vila", categoria: "Moda e acessórios", cidade: "Sao Paulo", uf: "SP" });
    await criarEmpresa("loja.centro", { nome: "Loja do Centro", categoria: "Moda e acessórios", cidade: "Sao Paulo", uf: "SP" });
    await criarEmpresa("atelie.sul", { nome: "Ateliê Sul", categoria: "Moda e acessórios", cidade: "São Paulo", uf: "SP" });
    expect(await cidadesCom("categoria", "Moda e acessórios")).toEqual([
      { cidade: "Sao Paulo", uf: "SP", total: 3 },
      { cidade: "Recife", uf: "PE", total: 1 },
    ]);
  });
});
