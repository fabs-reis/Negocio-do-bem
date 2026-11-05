"use client";

import { useActionState } from "react";
import { avisarCorrecao } from "@/acoes/correcoes";
import { Aviso } from "@/components/Aviso";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { Campo } from "@/components/Campo";
import { enviarSemLimpar } from "@/components/envio";

export function FormCorrecao({ empresaId }: { empresaId: string }) {
  const [estado, enviar, pendente] = useActionState(avisarCorrecao, undefined);
  return (
    <form action={enviar} onSubmit={enviarSemLimpar(enviar)} className="cartao space-y-5 p-6 sm:p-8">
      <input type="hidden" name="empresaId" value={empresaId} />
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      <Campo id="problema" rotulo="O que está errado?" erro={estado?.erros?.problema}>
        <textarea id="problema" name="problema" required minLength={10} maxLength={1000} rows={4} className="campo" defaultValue={String(estado?.valores?.problema ?? "")} />
      </Campo>
      <Campo id="correcao" rotulo="Qual é o dado certo?" erro={estado?.erros?.correcao} ajuda="Se o dado não deveria aparecer, peça a remoção. Não envie documentos nem dados pessoais desnecessários.">
        <textarea id="correcao" name="correcao" required minLength={2} maxLength={1000} rows={4} className="campo" defaultValue={String(estado?.valores?.correcao ?? "")} />
      </Campo>
      <Campo id="fonte" rotulo="Link que mostra a correção (opcional)" erro={estado?.erros?.fonte}>
        <input id="fonte" name="fonte" type="url" maxLength={1000} placeholder="https://" className="campo" defaultValue={String(estado?.valores?.fonte ?? "")} />
      </Campo>
      <p className="text-sm text-suave">O aviso e sua identidade ficam visíveis apenas para a moderação. Os dados do perfil só mudam depois da análise.</p>
      <BotaoEnviar className="botao" pendente={pendente}>Enviar aviso</BotaoEnviar>
    </form>
  );
}
