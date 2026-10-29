import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buscarDiretorio, resumoDoDiretorio } from "@/lib/consultas";
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

  it("junta a mesma cidade escrita de jeitos diferentes, na lista e no filtro", async () => {
    // Cadastros de antes da lista do IBGE gravaram a cidade como foi digitada.
    await criarEmpresa("brecho.sp", { nome: "Brechó Sem Acento", categoria: "Moda e acessórios", cidade: "Sao Paulo", uf: "SP" });
    await criarEmpresa("pet.sp", { nome: "Pet Maiúsculo", categoria: "Pet", cidade: "SÃO PAULO ", uf: "SP" });
    await criarEmpresa("bistro.floripa", { nome: "Bistrô Floripa", categoria: "Restaurante e bar", cidade: "Florianopolis", uf: "SC" });

    const r = await buscarDiretorio(filtros({ onde: "São Paulo, SP" }));
    expect(r.cidades).toEqual([
      { cidade: "Florianópolis", uf: "SC", total: 1 },
      { cidade: "Recife", uf: "PE", total: 2 },
      { cidade: "São Paulo", uf: "SP", total: 3 },
    ]);
    expect(r.local).toEqual({ cidade: "São Paulo", uf: "SP", rotulo: "São Paulo, SP" });
    expect(r.total).toBe(3);
    expect(r.porCategoria).toEqual({ "Café e padaria": 1, "Moda e acessórios": 1, Pet: 1 });
    expect((await buscarDiretorio(filtros({ onde: "sao paulo sp" }))).total).toBe(3);

    // Só com a grafia sem acento no banco: a lista mostra o nome oficial e o filtro acha.
    const floripa = await buscarDiretorio(filtros({ onde: "Florianópolis, SC" }));
    expect(floripa.itens.map((e) => e.instagramUsername)).toEqual(["bistro.floripa"]);
    expect((await buscarDiretorio(filtros({ onde: "florianopolis" }))).total).toBe(1);
    expect((await resumoDoDiretorio()).cidades).toBe(3);
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
