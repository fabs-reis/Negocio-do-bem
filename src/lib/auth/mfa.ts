import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// RFC 6238. Segredos protegidos em repouso por AES-256-GCM; a chave NÃO fica no banco.
const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const PERIODO_SEGUNDOS = 30;

function chaveDeCriptografia(): Buffer {
  const valor = process.env.MFA_ENCRYPTION_KEY;
  const chave = Buffer.from(valor ?? "", "base64");
  if (chave.length !== 32) throw new Error("MFA_ENCRYPTION_KEY deve conter 32 bytes codificados em base64.");
  return chave;
}

function emBase32(bytes: Buffer): string {
  let bits = 0;
  let valor = 0;
  let saida = "";
  for (const byte of bytes) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      saida += ALFABETO[(valor >>> (bits -= 5)) & 31];
    }
  }
  if (bits > 0) saida += ALFABETO[(valor << (5 - bits)) & 31];
  return saida;
}

function deBase32(segredo: string): Buffer {
  let bits = 0;
  let valor = 0;
  const bytes: number[] = [];
  for (const letra of segredo.toUpperCase().replace(/=+$/, "")) {
    const indice = ALFABETO.indexOf(letra);
    if (indice < 0) throw new Error("Segredo MFA inválido.");
    valor = (valor << 5) | indice;
    bits += 5;
    if (bits >= 8) {
      bytes.push((valor >>> (bits -= 8)) & 255);
      valor &= (1 << bits) - 1;
    }
  }
  return Buffer.from(bytes);
}

export function gerarSegredoMfa(): string {
  return emBase32(randomBytes(20));
}

export function criptografarSegredoMfa(segredo: string): string {
  const iv = randomBytes(12);
  const cifra = createCipheriv("aes-256-gcm", chaveDeCriptografia(), iv);
  const texto = Buffer.concat([cifra.update(segredo, "utf8"), cifra.final()]);
  return ["v1", iv.toString("base64url"), cifra.getAuthTag().toString("base64url"), texto.toString("base64url")].join(".");
}

export function descriptografarSegredoMfa(dado: string): string {
  const partes = dado.split(".");
  if (partes.length !== 4 || partes[0] !== "v1") throw new Error("Formato do segredo MFA desconhecido.");
  const iv = Buffer.from(partes[1]!, "base64url");
  const tag = Buffer.from(partes[2]!, "base64url");
  if (iv.length !== 12 || tag.length !== 16) throw new Error("Segredo MFA inválido.");
  const cifra = createDecipheriv("aes-256-gcm", chaveDeCriptografia(), iv);
  cifra.setAuthTag(tag);
  return Buffer.concat([cifra.update(Buffer.from(partes[3]!, "base64url")), cifra.final()]).toString("utf8");
}

function codigoNoPeriodo(segredo: string, periodo: number): string {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(periodo));
  const hmac = createHmac("sha1", deBase32(segredo)).update(contador).digest();
  const deslocamento = hmac[hmac.length - 1]! & 15;
  const numero = (hmac.readUInt32BE(deslocamento) & 0x7fffffff) % 1_000_000;
  return String(numero).padStart(6, "0");
}

/** Devolve o período usado para permitir bloqueio de reutilização por conta. */
export function validarCodigoMfa(segredo: string, codigo: string, agora = Date.now()): number | null {
  if (!/^\d{6}$/.test(codigo)) return null;
  const periodoAtual = Math.floor(agora / (PERIODO_SEGUNDOS * 1000));
  for (const diferenca of [-1, 0, 1]) {
    const periodo = periodoAtual + diferenca;
    const esperado = codigoNoPeriodo(segredo, periodo);
    if (timingSafeEqual(Buffer.from(codigo), Buffer.from(esperado))) return periodo;
  }
  return null;
}

export function gerarCodigosRecuperacao(): string[] {
  return Array.from({ length: 10 }, () => {
    const valor = randomBytes(16).toString("hex").toUpperCase();
    return valor.match(/.{1,4}/g)!.join("-");
  });
}

export function hashCodigoRecuperacao(codigo: string): string | null {
  const normalizado = codigo.replace(/[-\s]/g, "").toUpperCase();
  if (!/^[0-9A-F]{32}$/.test(normalizado)) return null;
  return createHash("sha256").update("ndb-recuperacao-mfa-v1:" + normalizado).digest("hex");
}
