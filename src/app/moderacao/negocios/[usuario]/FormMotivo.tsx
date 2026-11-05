"use client";

import { useActionState } from "react";
import { editarMotivoIndicacao } from "@/acoes/correcoes";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { Campo } from "@/components/Campo";
import { enviarSemLimpar } from "@/components/envio";

export function FormMotivo({ empresaId, motivo }: { empresaId: string; motivo: string | null }) {
  const [estado, enviar, pendente] = useActionState(editarMotivoIndicacao, undefined);
  return (
    <form action={enviar} onSubmit={enviarSemLimpar(enviar)} className="cartao space-y-4 p-6 sm:p-8">
      <input type="hidden" name="empresaId" value={empresaId} />
      <Campo id="motivo" rotulo="Motivo da indicação" erro={estado?.erros?.motivo} ajuda="Texto enviado por quem indicou. Deixe vazio para removê-lo do perfil. A alteração fica na auditoria.">
        <textarea id="motivo" name="motivo" rows={4} maxLength={600} className="campo" defaultValue={String(estado?.valores?.motivo ?? motivo ?? "")} />
      </Campo>
      <BotaoEnviar className="botao" pendente={pendente}>Salvar motivo</BotaoEnviar>
    </form>
  );
}
