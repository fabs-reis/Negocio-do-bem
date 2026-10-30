import { filtrarCausas } from "@/lib/causas";

export type ItemDoPerfil = { rotulo: string; feito: boolean; href: string };

/**
 * As boas-vindas do painel do dono: as três coisas que deixam o perfil com a cara
 * do negócio, cada uma com o link da sua seção, e o convite para o selo de perfil
 * oficial. `confirmacaoLigada` diz se o código por DM ou o Entrar com Instagram
 * está ligado. O bloco some quando as três coisas estão feitas e não há selo a pedir.
 */
export function checklistDoPerfil(
  empresa: { fotoUrl: string | null; historia: string; causas: { causa: string }[]; oficial: boolean },
  confirmacaoLigada: boolean,
): { itens: ItemDoPerfil[]; pedirSelo: boolean; mostrar: boolean } {
  const itens = [
    { rotulo: "Uma foto", feito: !!empresa.fotoUrl, href: "#foto" },
    {
      rotulo: "As causas que vocês vivem",
      feito: filtrarCausas(empresa.causas.map((c) => c.causa)).length > 0,
      href: "#causas",
    },
    { rotulo: "A história de vocês", feito: empresa.historia.trim() !== "", href: "#historia" },
  ];
  const pedirSelo = !empresa.oficial && confirmacaoLigada;
  return { itens, pedirSelo, mostrar: pedirSelo || itens.some((item) => !item.feito) };
}
