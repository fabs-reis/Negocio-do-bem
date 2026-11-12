// Tipos comuns das figuras do cortejo.

/** Os três esqueletos do cortejo. Cada um tem as suas classes e o seu ciclo (ver ../RIG.md). */
export type Rig = "bipede" | "cadeira" | "quadrupede";

/** O que o palco passa para cada figura. */
export type PropsDaFigura = {
  /** A palavra da placa. O caramelo não usa. */
  placa?: string;
};

/** As classes de rig que cada esqueleto precisa ter, cada uma uma vez e com o seu pivô. */
export const CLASSES_DO_RIG = {
  bipede: [
    "r-corpo",
    "r-cabeca",
    "r-braco-tras",
    "r-antebraco-tras",
    "r-braco-frente",
    "r-perna-tras",
    "r-canela-tras",
    "r-pe-tras",
    "r-perna-frente",
    "r-canela-frente",
    "r-pe-frente",
    "r-placa",
  ],
  cadeira: [
    "r-corpo",
    "r-cabeca",
    "r-braco-tras",
    "r-antebraco-tras",
    "r-braco-frente",
    "r-antebraco-frente",
    "r-cadeira",
    "r-roda-tras",
    "r-roda-frente",
    "r-placa",
  ],
  quadrupede: [
    "r-corpo",
    "r-cabeca",
    "r-pata-1",
    "r-pata-1-baixo",
    "r-pata-2",
    "r-pata-2-baixo",
    "r-pata-3",
    "r-pata-3-baixo",
    "r-pata-4",
    "r-pata-4-baixo",
    "r-rabo",
  ],
} as const satisfies Record<Rig, readonly string[]>;
