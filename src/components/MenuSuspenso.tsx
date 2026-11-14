"use client";

import { useEffect, useRef, type ComponentProps } from "react";

/**
 * Um `<details>` usado como menu suspenso (#366). Sem JavaScript, abre e fecha pelo próprio
 * botão, como antes. Com JavaScript, também fecha ao clicar ou tocar fora, ao apertar Esc
 * (o foco volta ao botão) e ao escolher um link de dentro, para o menu não ficar
 * aberto na página seguinte.
 */
export function MenuSuspenso(props: ComponentProps<"details">) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const menu = ref.current;
    if (!menu) return;

    function fecharSeFora(evento: PointerEvent) {
      if (menu!.open && !menu!.contains(evento.target as Node)) menu!.open = false;
    }
    function fecharComEsc(evento: KeyboardEvent) {
      if (evento.key !== "Escape" || !menu!.open) return;
      menu!.open = false;
      menu!.querySelector("summary")?.focus();
    }
    function fecharAoEscolher(evento: MouseEvent) {
      if ((evento.target as Element).closest("a")) menu!.open = false;
    }

    document.addEventListener("pointerdown", fecharSeFora);
    document.addEventListener("keydown", fecharComEsc);
    menu.addEventListener("click", fecharAoEscolher);
    return () => {
      document.removeEventListener("pointerdown", fecharSeFora);
      document.removeEventListener("keydown", fecharComEsc);
      menu.removeEventListener("click", fecharAoEscolher);
    };
  }, []);

  return <details ref={ref} {...props} />;
}
