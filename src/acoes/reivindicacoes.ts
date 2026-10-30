"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { exigirUsuario } from "@/lib/auth/sessao";
import { AVISOS } from "@/lib/avisos";
import { cnpjValido, limparCnpj } from "@/lib/cnpj";
import { db } from "@/lib/db";
import { campoSite, errosPorCampo, texto, valoresDoFormulario, type EstadoFormulario } from "@/lib/formulario";
import { perfilOficial } from "@/lib/instagram";
import { avisarNovaReivindicacao } from "@/lib/notificacoes";
import {
  cancelar,
  confirmarCodigo,
  ErroReivindicacao,
  iniciarPorCodigoDm,
  pedirOutroEnvio,
  solicitarPorDocumento,
} from "@/lib/reivindicacao";

async function carregar(dados: FormData) {
  const empresa = await db.empresa.findUnique({ where: { id: texto(dados, "empresaId") } });
  if (!empresa) redirect("/");
  const caminho = `/empresas/${empresa.instagramUsername}/reivindicar`;
  const usuario = await exigirUsuario(caminho);
  return { empresa, usuario, caminho };
}

/** Pede o código: a moderação recebe o aviso e responde pela DM do @ do projeto. */
export async function pedirCodigoDm(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  // Sem exigir o e-mail confirmado: a DM prova mais do que o e-mail, que fica para depois.
  const { empresa, usuario, caminho } = await carregar(dados);
  if (!perfilOficial()) return { erro: "A confirmação por DM está desligada. Peça uma análise manual abaixo." };
  let aguardaEnvio: boolean;
  try {
    const pedido = await iniciarPorCodigoDm(empresa.id, usuario.id);
    aguardaEnvio = pedido.envios === 0;
  } catch (erro) {
    if (erro instanceof ErroReivindicacao) return { erro: erro.message };
    throw erro;
  }
  if (aguardaEnvio) after(() => avisarNovaReivindicacao(empresa.id));
  redirect(`${caminho}?aviso=codigo_pedido#codigo`);
}

export async function confirmarCodigoDm(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const { empresa, usuario, caminho } = await carregar(dados);
  let resultado: Awaited<ReturnType<typeof confirmarCodigo>>;
  try {
    resultado = await confirmarCodigo({ empresaId: empresa.id, usuarioId: usuario.id, texto: texto(dados, "codigo") });
  } catch (erro) {
    if (erro instanceof ErroReivindicacao) return { erro: erro.message, valores: valoresDoFormulario(dados) };
    throw erro;
  }
  if (resultado === "em_analise") {
    after(() => avisarNovaReivindicacao(empresa.id));
    redirect(`${caminho}?aviso=codigo_em_analise#codigo`);
  }
  redirect(`/painel/${empresa.instagramUsername}?aviso=verificada`);
}

export async function pedirOutroEnvioDm(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const { empresa, usuario, caminho } = await carregar(dados);
  try {
    await pedirOutroEnvio(empresa.id, usuario.id);
  } catch (erro) {
    if (erro instanceof ErroReivindicacao) return { erro: erro.message };
    throw erro;
  }
  after(() => avisarNovaReivindicacao(empresa.id));
  redirect(`${caminho}?aviso=reenvio_pedido#codigo`);
}

const esquemaDocumento = z.object({
  cnpj: z
    .string()
    .trim()
    .transform((valor, ctx) => {
      if (!valor) return null;
      if (!cnpjValido(valor)) {
        ctx.addIssue({ code: "custom", message: "Este CNPJ não parece válido. Confira os números." });
        return z.NEVER;
      }
      return limparCnpj(valor);
    }),
  site: campoSite,
  relacao: z.string().trim().min(2, "Conte qual é a sua relação com o negócio.").max(120),
  contato: z.string().trim().min(5, "Deixe um WhatsApp ou e-mail para a moderação falar com você.").max(160),
  mensagem: z.string().trim().max(1000, "Use até 1.000 caracteres."),
});

export async function enviarDocumento(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const { empresa, usuario, caminho } = await carregar(dados);
  if (!usuario.emailConfirmado) return { erro: AVISOS.confirmar_email.texto, valores: valoresDoFormulario(dados) };
  const resultado = esquemaDocumento.safeParse({
    cnpj: texto(dados, "cnpj"),
    site: texto(dados, "site"),
    relacao: texto(dados, "relacao"),
    contato: texto(dados, "contato"),
    mensagem: texto(dados, "mensagem"),
  });
  if (!resultado.success) return { erros: errosPorCampo(resultado.error), valores: valoresDoFormulario(dados) };

  try {
    await solicitarPorDocumento({
      empresaId: empresa.id,
      usuarioId: usuario.id,
      ...resultado.data,
      mensagem: resultado.data.mensagem || null,
    });
  } catch (erro) {
    if (erro instanceof ErroReivindicacao) return { erro: erro.message, valores: valoresDoFormulario(dados) };
    throw erro;
  }
  after(() => avisarNovaReivindicacao(empresa.id));
  redirect(`${caminho}?aviso=documento_enviado`);
}

export async function cancelarReivindicacao(dados: FormData): Promise<void> {
  const { usuario, caminho } = await carregar(dados);
  await cancelar(texto(dados, "reivindicacaoId"), usuario.id);
  redirect(`${caminho}?aviso=cancelada`);
}
