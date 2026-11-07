"use server";

import { redirect } from "next/navigation";
import { exigirUsuario } from "@/lib/auth/sessao";
import { db } from "@/lib/db";
import { errosPorCampo, texto, valoresDoFormulario, type EstadoFormulario } from "@/lib/formulario";
import { medir } from "@/lib/medicao-servidor";
import {
  criarOferta,
  encerrarOferta,
  ErroOferta,
  esquemaDaOferta,
  gerarCupom,
  hojeEmBrasilia,
  normalizarCodigo,
  usarCupom,
} from "@/lib/ofertas";

async function negocio(empresaId: string) {
  const empresa = await db.empresa.findUnique({ where: { id: empresaId }, select: { id: true, instagramUsername: true, categoria: true, uf: true } });
  if (!empresa) redirect("/painel");
  return empresa;
}

/** O dono liberado cria a oferta do negócio, no painel do clube. */
export async function criarOfertaAcao(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const empresa = await negocio(texto(dados, "empresaId"));
  const usuario = await exigirUsuario(`/painel/${empresa.instagramUsername}/clube`);
  const valores = valoresDoFormulario(dados, ["ondeVale"]);
  const resultado = esquemaDaOferta(hojeEmBrasilia()).safeParse({
    titulo: texto(dados, "titulo"),
    tipo: texto(dados, "tipo"),
    valor: texto(dados, "valor"),
    condicoes: texto(dados, "condicoes"),
    ondeVale: dados.getAll("ondeVale").map(String),
    ultimoDia: texto(dados, "ultimoDia"),
    limite: texto(dados, "limite"),
  });
  if (!resultado.success) return { erros: errosPorCampo(resultado.error), valores };
  try {
    await criarOferta(empresa.id, usuario.id, resultado.data);
  } catch (erro) {
    if (erro instanceof ErroOferta) return { erro: erro.mensagem, valores };
    throw erro;
  }
  await medir({ nome: "oferta_criada", params: { categoria: empresa.categoria, uf: empresa.uf } });
  redirect(`/painel/${empresa.instagramUsername}/clube?aviso=oferta_criada`);
}

/** Qualquer dono encerra a oferta antes do fim. Os cupons já gerados valem até o fim previsto. */
export async function encerrarOfertaAcao(dados: FormData): Promise<void> {
  const usuario = await exigirUsuario("/painel");
  const username = await encerrarOferta(texto(dados, "ofertaId"), usuario.id);
  if (!username) redirect("/painel");
  redirect(`/painel/${username}/clube?aviso=oferta_encerrada`);
}

/** "Favoritar e gerar cupom", no perfil. Volta ao perfil, que mostra o código. */
export async function gerarCupomAcao(dados: FormData): Promise<void> {
  const oferta = await db.oferta.findUnique({
    where: { id: texto(dados, "ofertaId") },
    select: { id: true, empresa: { select: { instagramUsername: true } } },
  });
  if (!oferta) redirect("/");
  const perfil = `/empresas/${oferta.empresa.instagramUsername}`;
  const usuario = await exigirUsuario(`${perfil}#clube`);
  if (!usuario.emailConfirmado) redirect(`${perfil}?aviso=confirmar_email#clube`);

  const resultado = await gerarCupom(oferta.id, usuario.id);
  if ("erro" in resultado) {
    redirect(resultado.erro === "dono" ? perfil : `${perfil}?aviso=${resultado.erro === "esgotada" ? "cupom_esgotado" : "cupom_indisponivel"}#clube`);
  }
  const params = { categoria: resultado.categoria, uf: resultado.uf };
  if (resultado.favoritou) await medir({ nome: "negocio_favoritado", params });
  if (resultado.novo) await medir({ nome: "cupom_gerado", params });
  redirect(`${perfil}?aviso=cupom_gerado#clube`);
}

const AVISO_DA_SITUACAO = {
  usado: "cupom_ja_usado",
  vencido: "cupom_vencido",
  suspenso: "cupom_suspenso",
  valido: "cupom_nao_encontrado",
  nao_encontrado: "cupom_nao_encontrado",
} as const;

/** "Marcar como usado", na validação do painel. Só um dono do negócio do cupom. */
export async function usarCupomAcao(dados: FormData): Promise<void> {
  const empresa = await negocio(texto(dados, "empresaId"));
  const usuario = await exigirUsuario(`/painel/${empresa.instagramUsername}/clube`);
  const codigo = normalizarCodigo(texto(dados, "codigo"));
  const resultado = await usarCupom(empresa.id, codigo, usuario.id);
  const destino = `/painel/${empresa.instagramUsername}/clube?codigo=${codigo}`;
  if (resultado.situacao === "usado_agora") {
    await medir({ nome: "cupom_usado", params: { categoria: resultado.categoria, uf: resultado.uf } });
    redirect(`${destino}&aviso=cupom_usado#validar`);
  }
  redirect(`${destino}&aviso=${AVISO_DA_SITUACAO[resultado.situacao]}#validar`);
}
