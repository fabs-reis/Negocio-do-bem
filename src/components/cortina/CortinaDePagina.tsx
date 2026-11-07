"use client";

import { useCallback, useEffect, useRef, useState, type TransitionEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { destinoDaBusca, enderecoNormalizado, proximaFaseCortina, type DestinoCortina, type EventoCortina, type FaseCortina } from "@/lib/cortina";
import "./cortina.css";

type Navegacao = DestinoCortina & { origem: string; enviada: boolean };

/**
 * A cortina cobre só a busca do diretório (formulários com `data-cortina`).
 * Links e os outros formulários seguem a navegação nativa, sem animação.
 */
export function CortinaDePagina() {
  const caminho = usePathname();
  const parametros = useSearchParams().toString();
  const router = useRouter();
  const roteador = useRef(router);
  const pendente = useRef<Navegacao | null>(null);
  const faseAtual = useRef<FaseCortina>("oculta");
  const seguranca = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const folha = useRef<HTMLDivElement>(null);
  const [fase, setFase] = useState<FaseCortina>("oculta");

  useEffect(() => { roteador.current = router; }, [router]);

  const mudar = useCallback((evento: EventoCortina) => {
    const proxima = proximaFaseCortina(faseAtual.current, evento);
    faseAtual.current = proxima;
    setFase(proxima);
  }, []);

  const liberar = useCallback(() => {
    clearTimeout(seguranca.current);
    pendente.current = null;
    mudar("cancelar");
  }, [mudar]);

  useEffect(() => {
    const movimento = matchMedia("(prefers-reduced-motion: reduce)");

    function seguirSemCortina() {
      const navegacao = pendente.current;
      liberar();
      if (navegacao && !navegacao.enviada) roteador.current.push(navegacao.href);
    }

    function enviar(evento: SubmitEvent) {
      if (movimento.matches || (window.__abertura && window.__abertura !== "aberta")) return;
      const formulario = evento.target instanceof HTMLFormElement ? evento.target : null;
      if (!formulario?.hasAttribute("data-cortina") || evento.defaultPrevented) return;
      const campos = [...new FormData(formulario, evento.submitter)]
        .filter((campo): campo is [string, string] => typeof campo[1] === "string");
      const destino = destinoDaBusca({ atual: location.href, acao: formulario.action, campos });
      if (!destino) return;
      evento.preventDefault();
      // O <Form> do Next ignora preventDefault quando não tem onSubmit próprio e
      // navegaria antes de a cortina cobrir. A cortina assume esta navegação.
      evento.stopPropagation();
      if (pendente.current) return;
      pendente.current = { ...destino, origem: enderecoNormalizado(location.pathname, location.search), enviada: false };
      mudar("iniciar");
      // Se o roteador ou um evento de transição falhar, a tela nunca prende a pessoa.
      seguranca.current = setTimeout(seguirSemCortina, 3200);
    }

    function tecla(evento: KeyboardEvent) {
      if (evento.key === "Escape") liberar();
    }
    function preferencia() {
      if (movimento.matches) seguirSemCortina();
    }

    document.addEventListener("submit", enviar, true);
    document.addEventListener("keydown", tecla);
    window.addEventListener("popstate", liberar);
    movimento.addEventListener("change", preferencia);
    return () => {
      document.removeEventListener("submit", enviar, true);
      document.removeEventListener("keydown", tecla);
      window.removeEventListener("popstate", liberar);
      movimento.removeEventListener("change", preferencia);
      clearTimeout(seguranca.current);
      pendente.current = null;
    };
  }, [liberar, mudar]);

  useEffect(() => {
    const navegacao = pendente.current;
    // A busca no próprio Explorar só muda os parâmetros, então o endereço inteiro conta.
    const endereco = enderecoNormalizado(caminho, parametros);
    if (!navegacao?.enviada || !caminho || endereco === navegacao.origem) return;
    const quadro = requestAnimationFrame(() => {
      if (pendente.current === navegacao) mudar("revelar");
    });
    return () => cancelAnimationFrame(quadro);
  }, [caminho, parametros, mudar]);

  function terminou(evento: TransitionEvent<HTMLDivElement>) {
    if (evento.target !== folha.current || evento.propertyName !== "transform") return;
    if (faseAtual.current === "fechando") {
      const navegacao = pendente.current;
      if (!navegacao) return;
      mudar("cobrir");
      navegacao.enviada = true;
      try {
        roteador.current.push(navegacao.href);
      } catch (erro) {
        liberar();
        throw erro;
      }
    } else if (faseAtual.current === "abrindo") {
      mudar("terminar");
      clearTimeout(seguranca.current);
      pendente.current = null;
    }
  }

  return (
    <div className="cortina-navegacao" data-fase={fase} aria-hidden="true" onTransitionEnd={terminou}>
      <div className="cortina-folha" ref={folha} />
      <div className="cortina-emblema" />
    </div>
  );
}
