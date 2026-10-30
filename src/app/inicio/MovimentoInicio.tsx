"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useFaseAbertura } from "@/components/Abertura";
import { useAbaOculta, useMovimentoPausado, useMovimentoReduzido } from "@/components/cortejo/movimento";
import type { Tinta } from "@/lib/cortejo";

/** A página já vem visível do servidor; só a abertura ativa coreografa sua entrada. */
export function EntradaAnimada({ children }: { children: ReactNode }) {
  const fase = useFaseAbertura();
  return <div className="inicio-entradaAnimada" data-fase={fase}>{children}</div>;
}

/** Cada laço para quando sai da tela, junto com a pausa geral e a preferência do sistema. */
export function Laco({ children, className, tinta }: { children: ReactNode; className: string; tinta?: Tinta }) {
  const elemento = useRef<HTMLDivElement>(null);
  const [naTela, setNaTela] = useState(false);
  const pausado = useMovimentoPausado();
  const reduzido = useMovimentoReduzido();
  const abaOculta = useAbaOculta();

  useEffect(() => {
    const alvo = elemento.current;
    if (!alvo) return;
    const observador = new IntersectionObserver(([entrada]) => setNaTela(entrada.isIntersecting), { threshold: 0.05 });
    observador.observe(alvo);
    return () => observador.disconnect();
  }, []);

  return (
    <div ref={elemento} className={className} data-tinta={tinta} data-movendo={naTela && !pausado && !reduzido && !abaOculta ? "sim" : "nao"}>
      {children}
    </div>
  );
}

export function SeloDoConvite() {
  const id = useId();
  return (
    <div className="inicio-selo" aria-hidden="true">
      <svg className="inicio-seloGirando" viewBox="0 0 180 180" focusable="false">
        <defs><path id={id} d="M90 24a66 66 0 1 1-.01 0" /></defs>
        <text><textPath href={`#${id}`} textLength="414" lengthAdjust="spacing">COMPRE DE QUEM FAZ O BEM · VEM COM A GENTE · </textPath></text>
      </svg>
      <svg className="inicio-seloSeta" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" focusable="false">
        <path d="M10 38 37 11M12 11h25v25" />
      </svg>
    </div>
  );
}
