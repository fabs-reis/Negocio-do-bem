"use client";

import { useActionState } from "react";
import { pedirVerificacaoAcao } from "@/acoes/clube";
import { Aviso } from "@/components/Aviso";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { Campo } from "@/components/Campo";
import { enviarSemLimpar } from "@/components/envio";

/** O CNPJ do negócio, para o dono pedir a verificação do Clube do Bem. `cnpj` vem preenchido quando já se conhece. */
export function FormVerificacao({ empresaId, cnpj, deNovo }: { empresaId: string; cnpj?: string; deNovo: boolean }) {
  const [estado, acao, pendente] = useActionState(pedirVerificacaoAcao, undefined);
  const enviado = estado?.valores?.cnpj;

  return (
    <form action={acao} onSubmit={enviarSemLimpar(acao)} className="space-y-4">
      <input type="hidden" name="empresaId" value={empresaId} />
      <Campo id="cnpj" rotulo="CNPJ do negócio" ajuda="O MEI também tem CNPJ. Só a moderação vê este número.">
        <input
          id="cnpj"
          name="cnpj"
          required
          inputMode="numeric"
          autoComplete="off"
          placeholder="00.000.000/0000-00"
          defaultValue={typeof enviado === "string" ? enviado : cnpj}
          className="campo max-w-xs"
        />
      </Campo>
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      <BotaoEnviar pendente={pendente} enviando="Enviando…" className="botao-coral">
        {deNovo ? "Pedir de novo" : "Pedir a verificação"}
      </BotaoEnviar>
    </form>
  );
}
