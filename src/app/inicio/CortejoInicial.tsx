import Link from "next/link";
import type { CSSProperties } from "react";
import { personagensDoCortejo, type PessoaDoCortejo } from "@/components/cortejo/dados";
import { PERSONAGENS } from "@/components/cortejo/personagens";

/** O cortejo continua visível sem JavaScript, sem inventar contagens enquanto o banco responde. */
export function CortejoInicial() {
  const Caramelo = PERSONAGENS.caramelo.Figura;
  const pessoas = personagensDoCortejo({}).filter((pessoa): pessoa is PessoaDoCortejo => pessoa.id !== "caramelo");
  return (
    <div className="cortejo pintura" data-estado="parado" style={{ "--textura-grao": "none", "--textura-falhas": "none" } as CSSProperties}>
      <div className="cortejo-palco">
        <ul className="cortejo-fila">
          {pessoas.map((pessoa, indice) => {
            const Figura = PERSONAGENS[pessoa.id].Figura;
            return (
              <li key={pessoa.id} className="cortejo-vaga">
                <Link href={pessoa.href} className="cortejo-pessoa" aria-label={`Ver negócios de ${pessoa.rotulo.toLocaleLowerCase("pt-BR")}`}>
                  <Figura placa={pessoa.placa} />
                </Link>
                {indice === pessoas.length - 1 && <div className="cortejo-cachorro" aria-hidden="true"><Caramelo /></div>}
              </li>
            );
          })}
        </ul>
      </div>
      <span className="sr-only">Encontre negócios pelo tipo, pela cidade ou pelas causas.</span>
    </div>
  );
}
