// Registro das figuras do cortejo: cada id leva ao seu componente e ao seu rig.
// Para trocar o desenho de uma figura, substitua só o arquivo dela (ver ../RIG.md).

import type { ComponentType } from "react";
import type { IdPersonagem } from "../dados";
import { Agricultor } from "./agricultor";
import { Caramelo } from "./caramelo";
import { Costureira } from "./costureira";
import { Padeira } from "./padeira";
import { Psicologa } from "./psicologa";
import type { PropsDaFigura, Rig } from "./tipos";

export { CLASSES_DO_RIG } from "./tipos";
export type { PropsDaFigura, Rig } from "./tipos";

export const PERSONAGENS = {
  padeira: { Figura: Padeira, rig: "bipede" },
  costureira: { Figura: Costureira, rig: "bipede" },
  psicologa: { Figura: Psicologa, rig: "cadeira" },
  agricultor: { Figura: Agricultor, rig: "bipede" },
  caramelo: { Figura: Caramelo, rig: "quadrupede" },
} as const satisfies Record<IdPersonagem, { Figura: ComponentType<PropsDaFigura>; rig: Rig }>;

/** A ordem do palco, da esquerda para a direita. */
export const ORDEM_DO_CORTEJO: IdPersonagem[] = ["padeira", "costureira", "psicologa", "agricultor", "caramelo"];
