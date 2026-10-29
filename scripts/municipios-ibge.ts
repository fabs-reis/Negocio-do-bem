// Baixa a lista de municípios do IBGE e grava em src/lib/municipios.json, agrupada
// por UF e em ordem alfabética. Rode quando o IBGE criar ou renomear um município.
//
// Uso: npm run municipios:atualizar

import { writeFile } from "node:fs/promises";
import path from "node:path";

const API = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado";
const DESTINO = path.resolve(process.cwd(), "src/lib/municipios.json");

type MunicipioIbge = { "municipio-nome": string; "UF-sigla": string };

async function principal() {
  const resposta = await fetch(API);
  if (!resposta.ok) throw new Error(`o IBGE respondeu ${resposta.status}`);
  const lista = (await resposta.json()) as MunicipioIbge[];

  const porUf: Record<string, string[]> = {};
  for (const municipio of lista) {
    (porUf[municipio["UF-sigla"]] ??= []).push(municipio["municipio-nome"]);
  }
  const ordenado = Object.fromEntries(
    Object.keys(porUf)
      .sort()
      .map((uf) => [uf, porUf[uf]!.sort((a, b) => a.localeCompare(b, "pt-BR"))]),
  );

  await writeFile(DESTINO, `${JSON.stringify(ordenado, null, 2)}\n`);
  console.log(`${lista.length} municípios de ${Object.keys(ordenado).length} UFs gravados em ${path.relative(process.cwd(), DESTINO)}.`);
}

principal().catch((erro) => {
  console.error(`Não deu para atualizar a lista: ${erro instanceof Error ? erro.message : erro}`);
  process.exit(1);
});
