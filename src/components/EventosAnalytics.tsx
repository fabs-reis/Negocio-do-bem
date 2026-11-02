"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { consentimentoPositivo, lerConsentimento, lerCookie } from "@/lib/consentimento-analytics";
import { COOKIE_EVENTOS, enviarEvento, lerEventos, origemDoTrafego, paginaPermitida, sanearEvento } from "@/lib/medicao";

/**
 * Só envia a página atual, sem busca, âncora ou título real.
 * A origem opaca exige destino `*`, restrito à referência do frame atual.
 * A resposta exige `source` do mesmo frame e origem `null`.
 */
export function EventosAnalytics({ consentimento }: { consentimento: string }) {
  const caminho = usePathname();
  const quadro = useRef<HTMLIFrameElement>(null);
  const pagina = paginaPermitida(caminho);

  useEffect(() => {
    if (!paginaPermitida(caminho) || !consentimentoPositivo(lerConsentimento())) return;
    let pronto = false;
    let ultimaPagina = "";
    function enviarPagina() {
      const atual = paginaPermitida(window.location.pathname);
      if (!pronto || !atual || !consentimentoPositivo(lerConsentimento()) || lerConsentimento() !== consentimento) return;
      if (ultimaPagina === window.location.pathname) return;
      ultimaPagina = window.location.pathname;
      quadro.current?.contentWindow?.postMessage({ tipo: "ndb:medir", nome: "page_view", params: {
        page_location: location.origin + atual.caminho, page_title: atual.titulo, page_referrer: "",
        origem_trafego: origemDoTrafego(document.referrer, location.origin),
      } }, "*");
    }
    function aoReceber(evento: MessageEvent) {
      if (evento.origin !== "null" || evento.source !== quadro.current?.contentWindow || evento.data?.tipo !== "ndb:pronto") return;
      pronto = true;
      enviarPagina();
    }
    function aoClicar(evento: MouseEvent) {
      const alvo = evento.target instanceof Element ? evento.target.closest<HTMLElement>("[data-medir]") : null;
      const { medir: nome, ...params } = alvo?.dataset ?? {};
      if (nome) enviarEvento(nome, params);
    }
    window.ndbEnviarAnalytics = evento => {
      const atual = paginaPermitida(location.pathname);
      const permitido = sanearEvento(evento.nome, evento.params);
      if (!pronto || !atual || !permitido || lerConsentimento() !== consentimento || !consentimentoPositivo(consentimento)) return;
      quadro.current?.contentWindow?.postMessage({ tipo: "ndb:medir", ...permitido, params: {
        ...permitido.params, page_location: location.origin + atual.caminho, page_title: atual.titulo, page_referrer: "",
      } }, "*");
    };
    function enviarPendentes() {
      if (!pronto) return;
      enviarPagina();
      const valor = lerCookie(COOKIE_EVENTOS);
      if (!valor) return;
      document.cookie = `${COOKIE_EVENTOS}=; Max-Age=0; Path=/; SameSite=Lax`;
      for (const evento of lerEventos(valor, consentimento)) enviarEvento(evento.nome, evento.params);
    }
    window.addEventListener("message", aoReceber);
    document.addEventListener("click", aoClicar);
    const intervalo = setInterval(enviarPendentes, 1000);
    return () => {
      clearInterval(intervalo);
      window.removeEventListener("message", aoReceber);
      document.removeEventListener("click", aoClicar);
      delete window.ndbEnviarAnalytics;
    };
  // O quadro é recriado em cada rota para descartar listeners e filas do provedor.
  }, [caminho, consentimento, pagina?.caminho]);

  return pagina ? <iframe key={caminho} ref={quadro} src="/api/analytics" title="Medição opcional" hidden referrerPolicy="no-referrer" sandbox="allow-scripts" /> : null;
}
