"use client";

import { useActionState } from "react";
import { confirmarCodigoDm, enviarDocumento, pedirCodigoDm, pedirOutroEnvioDm } from "@/acoes/reivindicacoes";
import { Aviso } from "@/components/Aviso";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { enviarSemLimpar } from "@/components/envio";
import { Campo } from "@/components/Campo";

export function FormPedirCodigo({ empresaId }: { empresaId: string }) {
  const [estado, acao, pendente] = useActionState(pedirCodigoDm, undefined);
  return (
    <form action={acao} onSubmit={enviarSemLimpar(acao)} className="mt-3 space-y-3">
      <input type="hidden" name="empresaId" value={empresaId} />
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      <BotaoEnviar pendente={pendente} className="botao-coral" enviando="Pedindo…">
        Pedir o código
      </BotaoEnviar>
    </form>
  );
}

export function FormConfirmarCodigo({ empresaId }: { empresaId: string }) {
  const [estado, acao, pendente] = useActionState(confirmarCodigoDm, undefined);
  const codigo = estado?.valores?.codigo;
  return (
    <form action={acao} onSubmit={enviarSemLimpar(acao)} className="space-y-3">
      <input type="hidden" name="empresaId" value={empresaId} />
      <Campo id="codigo" rotulo="Código que chegou na DM">
        <input
          id="codigo"
          name="codigo"
          required
          maxLength={20}
          placeholder="BEM-7K3F9Q"
          defaultValue={typeof codigo === "string" ? codigo : ""}
          className="campo font-mono uppercase"
          autoCapitalize="characters"
          autoComplete="one-time-code"
        />
      </Campo>
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      <BotaoEnviar pendente={pendente} enviando="Conferindo…">
        Confirmar
      </BotaoEnviar>
    </form>
  );
}

export function FormOutroEnvio({ empresaId }: { empresaId: string }) {
  const [estado, acao, pendente] = useActionState(pedirOutroEnvioDm, undefined);
  return (
    <form action={acao} className="space-y-3">
      <input type="hidden" name="empresaId" value={empresaId} />
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      <BotaoEnviar pendente={pendente} className="botao-claro" enviando="Pedindo…">
        Pedir outro envio
      </BotaoEnviar>
    </form>
  );
}

export function FormDocumento({ empresaId }: { empresaId: string }) {
  const [estado, acao, pendente] = useActionState(enviarDocumento, undefined);
  const valor = (campo: string) => {
    const v = estado?.valores?.[campo];
    return typeof v === "string" ? v : "";
  };
  return (
    <form action={acao} onSubmit={enviarSemLimpar(acao)} className="mt-6 space-y-4">
      <input type="hidden" name="empresaId" value={empresaId} />
      <Campo id="relacao" rotulo="Qual é a sua relação com o negócio?" erro={estado?.erros?.relacao}>
        <input id="relacao" name="relacao" required maxLength={120} placeholder="Ex.: sou a fundadora, sou sócio…" defaultValue={valor("relacao")} className="campo" />
      </Campo>
      <Campo id="cnpj" rotulo="CNPJ ou MEI (opcional)" erro={estado?.erros?.cnpj} ajuda="Ajuda a moderação a conferir o registro do negócio.">
        <input id="cnpj" name="cnpj" maxLength={20} placeholder="00.000.000/0000-00" defaultValue={valor("cnpj")} className="campo" />
      </Campo>
      <Campo id="site" rotulo="Site do negócio (opcional)" erro={estado?.erros?.site}>
        <input id="site" name="site" maxLength={200} placeholder="www.meunegocio.com.br" defaultValue={valor("site")} className="campo" autoCapitalize="none" />
      </Campo>
      <Campo id="contato" rotulo="Como a moderação fala com você?" erro={estado?.erros?.contato}>
        <input id="contato" name="contato" required maxLength={160} placeholder="WhatsApp ou e-mail do negócio" defaultValue={valor("contato")} className="campo" />
      </Campo>
      <Campo id="mensagem" rotulo="Algo mais que devemos saber? (opcional)" erro={estado?.erros?.mensagem}>
        <textarea id="mensagem" name="mensagem" rows={3} maxLength={1000} defaultValue={valor("mensagem")} className="campo" />
      </Campo>
      {estado?.erro && <Aviso tipo="erro">{estado.erro}</Aviso>}
      <BotaoEnviar pendente={pendente} enviando="Enviando…">Pedir análise</BotaoEnviar>
    </form>
  );
}
