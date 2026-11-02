import { useId, type CSSProperties } from "react";
import { ICONE, LOGO, TEXTO_DO_LOGO } from "@/lib/marca";

// Ordem do desenho: da esquerda para a direita, como as três pessoas se dão as mãos.
const PESSOAS = [
  { nome: "verde", cor: "text-marca-verde", atraso: "0.05s" },
  { nome: "laranja", cor: "text-marca-laranja", atraso: "0.28s" },
  { nome: "terceira", cor: "text-marca-marrom escuro:text-marca-creme", atraso: "0.51s" },
] as const;

// "Negócio" fica acima de y = 72 no desenho do logo; "do Bem", abaixo.
const LINHA = { x: 176, divisa: 72, largura: 346 } as const;

/**
 * O mesmo logo do Logo.tsx, preparado para se desenhar na Abertura: um traço
 * provisório contorna cada pessoa, a cor preenche e o texto se escreve linha a
 * linha. A animação vem do globals.css e só roda com data-abertura no <html>;
 * sem ele, o desenho é o logo pronto, sem traço.
 */
export function LogoAnimado({ className }: { className?: string }) {
  const id = useId();
  const texto = `${id}-texto`;
  return (
    <svg viewBox={`0 0 ${LOGO.largura} ${LOGO.altura}`} width={LOGO.largura} height={LOGO.altura} aria-hidden="true" className={className}>
      <defs>
        <g id={texto} transform={TEXTO_DO_LOGO.transformacao}>
          <path d={TEXTO_DO_LOGO.negocioBem} className="fill-marca-marrom escuro:fill-marca-creme" />
          <path d={TEXTO_DO_LOGO.do} className="fill-marca-laranja" />
        </g>
        <clipPath id={`${id}-linha-1`}>
          <rect className="la-linha" x={LINHA.x} y={0} width={LINHA.largura} height={LINHA.divisa} />
        </clipPath>
        <clipPath id={`${id}-linha-2`}>
          <rect className="la-linha la-linha-2" x={LINHA.x} y={LINHA.divisa} width={LINHA.largura} height={LOGO.altura - LINHA.divisa} />
        </clipPath>
      </defs>
      <g transform={`scale(${LOGO.escalaDoIcone})`}>
        {PESSOAS.map(({ nome, cor, atraso }) => (
          <g key={nome} className={`la-pessoa ${cor}`} fill="currentColor" style={{ "--atraso": atraso } as CSSProperties}>
            <path d={ICONE[nome].corpo} pathLength={1} />
            <circle {...ICONE[nome].cabeca} pathLength={1} />
          </g>
        ))}
      </g>
      <g clipPath={`url(#${id}-linha-1)`}>
        <use href={`#${texto}`} />
      </g>
      <g clipPath={`url(#${id}-linha-2)`}>
        <use href={`#${texto}`} />
      </g>
    </svg>
  );
}
