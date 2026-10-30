// Textos do cortejo: o nome dos links, a contagem e o desenho das palavras nas placas.

/** Nome acessível do link de uma pessoa: "Ver negócios de café e padaria". */
export function rotuloDoLink(categoria: string): string {
  return `Ver negócios de ${categoria.charAt(0).toLocaleLowerCase("pt-BR")}${categoria.slice(1)}`;
}

export function textoDoTotal(total: number): string {
  if (total <= 0) return "Nenhum negócio ainda";
  return `${total.toLocaleString("pt-BR")} ${total === 1 ? "negócio" : "negócios"}`;
}

/** As linhas da placa, em maiúsculas. Uma frase de mais de cinco letras quebra nos espaços. */
export function linhasDaPlaca(placa: string): string[] {
  const texto = placa.trim().replace(/\s+/g, " ").toLocaleUpperCase("pt-BR");
  if (!texto) return [];
  return texto.length > 5 && texto.includes(" ") ? texto.split(" ") : [texto];
}

// Largura média de cada letra numa fonte condensada e pesada, em "em".
// O texto da placa usa textLength com esse valor: com qualquer fonte, a palavra cabe e fica do mesmo tamanho.
function larguraEstimada(texto: string): number {
  let em = 0;
  for (const letra of texto) em += letra === " " ? 0.26 : "MW".includes(letra) ? 0.66 : "IJ1".includes(letra) ? 0.28 : 0.52;
  return em;
}

const ENTRELINHA = 0.92;

export type MedidasDaPlaca = {
  /** Corpo da fonte, nas unidades do SVG. */
  tamanho: number;
  /** Cada linha com o centro vertical (y, a partir do topo da área) e o comprimento a usar em textLength. */
  linhas: { texto: string; y: number; comprimento: number }[];
};

/** O maior corpo em que todas as linhas cabem na área, sem esticar palavra curta até a borda. */
export function medidasDaPlaca(linhas: string[], area: { largura: number; altura: number }): MedidasDaPlaca {
  if (linhas.length === 0) return { tamanho: 0, linhas: [] };
  const n = linhas.length;
  const limiteDaAltura = n === 1 ? area.altura * 0.78 : area.altura / (n * ENTRELINHA);
  const limiteDaLargura = Math.min(...linhas.map((linha) => area.largura / larguraEstimada(linha)));
  const tamanho = Math.min(limiteDaAltura, limiteDaLargura);
  return {
    tamanho,
    linhas: linhas.map((texto, i) => ({
      texto,
      y: area.altura / 2 + (i - (n - 1) / 2) * tamanho * ENTRELINHA,
      comprimento: Math.min(area.largura, larguraEstimada(texto) * tamanho),
    })),
  };
}
