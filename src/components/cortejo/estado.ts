// Se o palco anda ou para, e por quê. O motivo vai para data-motivo no palco.

export type MotivoDaPausa = "carregando" | "movimento-reduzido" | "visitante" | "aba-oculta" | "fora-da-tela";

export type CondicoesDoPalco = {
  /** O JavaScript já assumiu o palco. Antes disso (e sem JavaScript) as figuras ficam paradas. */
  montado: boolean;
  movimentoReduzido: boolean;
  visitantePausou: boolean;
  abaOculta: boolean;
  foraDaTela: boolean;
};

export type EstadoDoPalco = { rodando: boolean; motivo: MotivoDaPausa | null };

/** O primeiro motivo que se aplica, nesta ordem, para o palco parar. */
export function estadoDoPalco(c: CondicoesDoPalco): EstadoDoPalco {
  const motivo: MotivoDaPausa | null = !c.montado
    ? "carregando"
    : c.movimentoReduzido
      ? "movimento-reduzido"
      : c.visitantePausou
        ? "visitante"
        : c.abaOculta
          ? "aba-oculta"
          : c.foraDaTela
            ? "fora-da-tela"
            : null;
  return { rodando: motivo === null, motivo };
}
