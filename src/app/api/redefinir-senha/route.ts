import { NextResponse, type NextRequest } from "next/server";
import { guardarTokenDeRedefinicao, tokenDeRedefinicaoValido } from "@/lib/auth/redefinicao";

/**
 * Destino do link do e-mail. Guarda o token num cookie e abre /redefinir-senha sem ele
 * na URL: assim ele não aparece no histórico nem vai para o Google Analytics.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token && (await tokenDeRedefinicaoValido(token))) await guardarTokenDeRedefinicao(token);
  const resposta = NextResponse.redirect(new URL("/redefinir-senha", request.url));
  resposta.headers.set("Referrer-Policy", "no-referrer");
  return resposta;
}
