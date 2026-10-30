"use client";

import { useActionState } from "react";
import { procurarNegocio } from "@/acoes/participacao";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { Campo } from "@/components/Campo";
import { enviarSemLimpar } from "@/components/envio";

/** A porta da página: um campo só, o @ do negócio. */
export function FormParticipar() {
  const [estado, acao, pendente] = useActionState(procurarNegocio, undefined);
  const erro = estado?.erros?.instagram;
  const valor = typeof estado?.valores?.instagram === "string" ? estado.valores.instagram : "";
  return (
    <form action={acao} onSubmit={enviarSemLimpar(acao)} className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="min-w-0 flex-1">
        <Campo
          id="instagram"
          rotulo="@ do seu negócio no Instagram"
          erro={erro}
          ajuda="Leva poucos minutos. Você completa o perfil depois, com calma."
        >
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-suave">@</span>
            <input
              id="instagram"
              name="instagram"
              required
              maxLength={80}
              placeholder="seunegocio"
              defaultValue={valor}
              aria-invalid={erro ? true : undefined}
              className="campo scroll-mt-32 pl-8"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
        </Campo>
      </div>
      {/* No computador, o botão fica ao lado do campo, abaixo da altura do rótulo. */}
      <BotaoEnviar pendente={pendente} className="botao-coral shrink-0 text-base sm:mt-[1.625rem]" enviando="Procurando…">
        Começar
      </BotaoEnviar>
    </form>
  );
}
