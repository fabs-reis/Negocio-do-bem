"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { removerFoto, trocarFoto } from "@/acoes/empresas";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { FotoEmpresa, type EmpresaDaFoto } from "@/components/FotoEmpresa";
import { reduzirFoto } from "@/components/reduzirFoto";

/** Escolher, trocar ou remover a foto do perfil. `voltar` é a página que recarrega depois. */
export function FormFoto({ empresa, voltar, podeTrocar = true }: { empresa: EmpresaDaFoto; voltar: string; podeTrocar?: boolean }) {
  const [estado, acao, pendente] = useActionState(trocarFoto, undefined);
  const [preparando, setPreparando] = useState(false);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const ocupado = preparando || pendente;
  const erro = erroLocal ?? estado?.erro;

  async function escolher(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!arquivo) return;
    setErroLocal(null);
    setPreparando(true);
    try {
      const foto = await reduzirFoto(arquivo, { lado: 600, quadrada: true });
      const dados = new FormData();
      dados.set("empresaId", empresa.id);
      dados.set("voltar", voltar);
      dados.set("foto", foto);
      startTransition(() => acao(dados));
    } catch {
      setErroLocal("Não conseguimos abrir essa imagem. Use uma foto JPG, PNG ou WebP.");
    } finally {
      setPreparando(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-5">
      <FotoEmpresa empresa={empresa} tamanho="lg" />
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {podeTrocar && (
            <>
              <input ref={entrada} type="file" accept="image/*" className="hidden" onChange={escolher} />
              <button type="button" className="botao-claro botao-pequeno" disabled={ocupado} onClick={() => entrada.current?.click()}>
                {ocupado ? "Enviando…" : empresa.fotoUrl ? "Trocar foto" : "Escolher foto"}
              </button>
            </>
          )}
          {empresa.fotoUrl && (
            <form action={removerFoto}>
              <input type="hidden" name="empresaId" value={empresa.id} />
              <input type="hidden" name="voltar" value={voltar} />
              <BotaoEnviar className="botao-claro botao-pequeno" enviando="Removendo…" disabled={ocupado}>
                Remover
              </BotaoEnviar>
            </form>
          )}
        </div>
        {podeTrocar && <p className="ajuda">O centro da foto aparece num círculo, no perfil e nos cards do diretório.</p>}
        {erro && <p className="erro-campo">{erro}</p>}
      </div>
    </div>
  );
}
