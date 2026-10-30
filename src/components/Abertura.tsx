"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { LogoAnimado } from "@/components/LogoAnimado";
import "@/components/cortina/cortina.css";

/**
 * Fase da abertura da página inicial, para a página combinar a sua entrada com ela:
 * - "cobrindo": a tela de papel cobre a página e o logo se desenha;
 * - "abrindo": as duas folhas começaram a abrir (no fim normal ou porque a pessoa pulou);
 * - "aberta": acabou, ou não houve abertura (outra página, aba que já viu,
 *   "reduzir movimento", sem sessionStorage). No servidor é sempre "aberta".
 *
 * Comece a entrada do título quando a fase deixar de ser "cobrindo".
 * O <html> também recebe data-abertura="cobrindo" | "abrindo" | "pulada"
 * enquanto a tela existe. Não esconda conteúdo só por esse atributo: se o
 * JavaScript parar, a tela sai pelo CSS, mas o atributo pode ficar.
 */
export type FaseAbertura = "cobrindo" | "abrindo" | "aberta";

const CHAVE = "abertura-vista";
const EVENTO = "abertura";

declare global {
  interface Window {
    __abertura?: FaseAbertura;
  }
}

/*
 * Roda no HTML, antes da primeira pintura e antes do React. Decide se há
 * abertura, marca a aba (recarregar não repete) e cuida de pular e de terminar:
 * - um toque, um clique, a roda do mouse ou uma tecla pulam;
 * - o clique que pula não chega ao que está embaixo da tela;
 * - no fim, o atributo sai do <html> e a tela some de vez.
 * A saída também está no CSS, como garantia se este script falhar no meio.
 */
const SCRIPT = `(function(){
var h=document.documentElement,w=window;
try{
if(location.pathname!=="/"||matchMedia("(prefers-reduced-motion: reduce)").matches||sessionStorage.getItem("${CHAVE}"))return;
sessionStorage.setItem("${CHAVE}","1");
}catch(e){return}
var fim=0,sobe=0,ate=0;
function fase(f,a){w.__abertura=f;if(a)h.setAttribute("data-abertura",a);else h.removeAttribute("data-abertura");w.dispatchEvent(new Event("${EVENTO}"))}
function engole(e){if(Date.now()<ate){e.preventDefault();e.stopPropagation()}}
function terminar(){if(fim)return;fim=1;fase("aberta");removeEventListener("pointerdown",pular,true);removeEventListener("keydown",pular,true);removeEventListener("wheel",pular,true);setTimeout(function(){removeEventListener("click",engole,true)},400)}
function pular(e){if(fim)return;
if(e.type==="pointerdown"){ate=Date.now()+700;e.preventDefault()}
if(e.type==="keydown"&&(e.key==="Enter"||e.key===" "))e.preventDefault();
if(sobe)return;sobe=1;fase("abrindo","pulada");setTimeout(terminar,600)}
w.__abertura="cobrindo";h.setAttribute("data-abertura","cobrindo");
addEventListener("pointerdown",pular,true);addEventListener("keydown",pular,true);addEventListener("wheel",pular,{capture:true,passive:true});addEventListener("click",engole,true);
document.addEventListener("animationstart",function(e){if(e.animationName==="cortina-abertura-esquerda"&&!sobe&&!fim){sobe=1;fase("abrindo","abrindo")}},true);
document.addEventListener("animationend",function(e){if(e.animationName==="cortina-abertura-direita"||e.animationName==="cortina-abertura-pula-direita")terminar()},true);
setTimeout(terminar,2600);
})()`;

function lerFase(): FaseAbertura {
  const fase = window.__abertura;
  return fase === "cobrindo" || fase === "abrindo" ? fase : "aberta";
}

function assinar(avisar: () => void) {
  window.addEventListener(EVENTO, avisar);
  return () => window.removeEventListener(EVENTO, avisar);
}

/** Fase atual da abertura (ver FaseAbertura). Atualiza quando a fase muda. */
export function useFaseAbertura(): FaseAbertura {
  return useSyncExternalStore(assinar, lerFase, () => "aberta");
}

/**
 * Tela de abertura da página inicial. Fica no layout raiz, como primeiro filho
 * do <body>, e só aparece em "/": quem decide é o script, pelo location.pathname.
 * Nas outras páginas a tela vem no HTML, mas escondida (display: none).
 * Ela não usa usePathname: com o Cache Components ele pediria um Suspense, e o
 * conteúdo do Suspense pode chegar depois da página, tarde para cobrir a
 * primeira pintura.
 * O script vai no HTML do servidor; no navegador o React o troca por text/plain,
 * então ele não roda de novo numa navegação sem recarregar.
 */
export function Abertura() {
  // Em desenvolvimento o React pode remontar o <html> e apagar o data-abertura.
  // Sem o atributo a tela já sumiu; aqui a fase acompanha, para a página não esperar.
  useLayoutEffect(() => {
    if (lerFase() !== "aberta" && !document.documentElement.hasAttribute("data-abertura")) {
      window.__abertura = "aberta";
      window.dispatchEvent(new Event(EVENTO));
    }
  }, []);

  return (
    <>
      <script
        type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: SCRIPT }}
      />
      <div className="cortina-abertura" aria-hidden="true">
        <div className="cortina-abertura-folha cortina-abertura-esquerda" />
        <div className="cortina-abertura-folha cortina-abertura-direita" />
        <LogoAnimado className="cortina-abertura-marca" />
      </div>
    </>
  );
}
