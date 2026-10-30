import { randomInt } from "node:crypto";

// Sem 0/O, 1/I/L: o dono vai digitar o código no Instagram.
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const TAMANHO = 6;

/** Gera um código como "BEM-7K3F9Q". */
export function gerarCodigo(): string {
  let codigo = "";
  for (let i = 0; i < TAMANHO; i++) codigo += ALFABETO[randomInt(ALFABETO.length)];
  return `BEM-${codigo}`;
}

/** Acha um código numa mensagem, mesmo escrito "bem 7k3f9q" ou "BEM7K3F9Q". */
export function extrairCodigo(texto: string): string | null {
  const achado = texto.match(/\bBEM[\s-]?([A-Z0-9]{6})\b/i);
  return achado ? `BEM-${achado[1]!.toUpperCase()}` : null;
}

/**
 * A mensagem que a moderação manda do @ do projeto para o @ do negócio. O nome
 * de quem pediu deixa o dono reconhecer o próprio pedido e avisar quando não foi
 * ele: assim ninguém pede o código e depois convence o dono a repassar.
 */
export function mensagemDoCodigo(params: { nome: string; codigo: string; endereco: string }): string {
  return [
    `${params.nome} pediu para cuidar do perfil do seu negócio no Negócio do Bem. Se foi você, cole este código em ${params.endereco}:`,
    params.codigo,
    "Não passe o código para ninguém, nem para a gente. Se não foi você, responda esta mensagem.",
  ].join("\n\n");
}
