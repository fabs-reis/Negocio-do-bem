// A porta de /participar: quem tem um negócio digita o @, e a página leva ao
// próximo passo. Sem banco, para testar cada caso sem navegador.

/** O negócio com aquele @, ou null quando ele ainda não está no Negócio do Bem. */
export type NegocioProcurado = { moderacao: string; oculta: boolean; donos: number } | null;

export type CasoDaProcura =
  /** Não existe: vai para a indicação, já como dono. */
  | "indicar"
  /** No diretório e sem dono: falta só confirmar que é seu. */
  | "confirmar"
  /** No diretório e com dono: pede revisão. */
  | "revisao"
  /** Tirado do ar ou oculto: a resposta não diz o motivo. */
  | "indisponivel";

/** Decide o caso e para onde a pessoa vai depois de digitar o @. */
export function decidirProcura(
  instagram: string,
  negocio: NegocioProcurado,
  logado: boolean,
): { caso: CasoDaProcura; destino: string } {
  if (!negocio) {
    const indicar = `/indicar?instagram=${encodeURIComponent(instagram)}&dono=sim`;
    // Sem conta, cria a conta antes e volta para a indicação com o @.
    return { caso: "indicar", destino: logado ? indicar : `/cadastrar?voltar=${encodeURIComponent(indicar)}` };
  }
  const caso: CasoDaProcura =
    negocio.moderacao !== "aprovada" || negocio.oculta ? "indisponivel" : negocio.donos > 0 ? "revisao" : "confirmar";
  return { caso, destino: `/participar?instagram=${encodeURIComponent(instagram)}#resultado` };
}

/** "Você vai estar em boa companhia: 12 negócios em 5 cidades." */
export function boaCompanhia(total: number, cidades: number): string {
  const negocios = `${total.toLocaleString("pt-BR")} ${total === 1 ? "negócio" : "negócios"}`;
  const emCidades = `${cidades.toLocaleString("pt-BR")} ${cidades === 1 ? "cidade" : "cidades"}`;
  return `Você vai estar em boa companhia: ${negocios} em ${emCidades}.`;
}
