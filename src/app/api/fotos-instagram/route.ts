import type { NextRequest } from "next/server";
import { conferirFoto } from "@/lib/armazenamento";
import { aplicarFotoDoInstagram, autorizado, negociosSemFoto, tokenDasFotos } from "@/lib/fotos-instagram";

// Usada só pelo script local da rotina de fotos (scripts/fotos-instagram.ts).
// Sem FOTOS_TOKEN configurado, a rota responde 404.

function negar(request: NextRequest): Response | null {
  const token = tokenDasFotos();
  if (!token) return new Response("Rotina de fotos desativada", { status: 404 });
  if (!autorizado(request.headers.get("authorization"), token)) return new Response("Token inválido", { status: 401 });
  return null;
}

/** Lista os negócios sem foto. */
export async function GET(request: NextRequest) {
  const negado = negar(request);
  if (negado) return negado;
  return Response.json({ negocios: await negociosSemFoto() });
}

/** Recebe a foto pronta de um negócio (multipart: empresaId e foto). */
export async function POST(request: NextRequest) {
  const negado = negar(request);
  if (negado) return negado;

  let dados: FormData;
  try {
    dados = await request.formData();
  } catch {
    return Response.json({ erro: "Envie multipart/form-data com empresaId e foto." }, { status: 400 });
  }
  const empresaId = dados.get("empresaId");
  if (typeof empresaId !== "string" || !empresaId) return Response.json({ erro: "Falta o empresaId." }, { status: 400 });
  const foto = await conferirFoto(dados.get("foto"));
  if ("erro" in foto) return Response.json({ erro: foto.erro }, { status: 400 });

  const resultado = await aplicarFotoDoInstagram(empresaId, foto);
  return Response.json({ resultado }, { status: resultado === "nao_encontrado" ? 404 : 200 });
}
