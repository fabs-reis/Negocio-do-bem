import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Parâmetros e fragmentos não mudam o objeto. Caminhos ambíguos nunca são descartados. */
export function identidadeDaFoto(valor: string): string | null {
  try {
    const semSufixo = valor.split(/[?#]/, 1)[0];
    if (decodeURIComponent(semSufixo).includes("..") || semSufixo.includes("\\")) return null;
    const local = valor.startsWith("/enviados/");
    const url = new URL(valor, local ? "https://local.invalid" : undefined);
    if (url.username || url.password || url.port) return null;
    if (!local && (url.protocol !== "https:" || !url.hostname.endsWith(".public.blob.vercel-storage.com"))) return null;
    const caminho = decodeURIComponent(url.pathname);
    const arquivo = local ? caminho.slice("/enviados/".length) : caminho.slice(1);
    if (!/^(historias|perfis)\/[a-f0-9]{24}\.(jpg|png|webp)$/.test(arquivo)) return null;
    return local ? `/enviados/${arquivo}` : `${url.origin}/${arquivo}`;
  } catch {
    return null;
  }
}

function identidadeDaReferencia(valor: string): string | null {
  try {
    const local = valor.startsWith("/enviados/");
    const url = new URL(valor, local ? "https://local.invalid" : undefined);
    if (local) return identidadeDaFoto(url.pathname);
    // Referências duvidosas preservam a foto. Isso não autoriza administrar essa URL.
    url.username = "";
    url.password = "";
    url.port = "";
    url.search = "";
    url.hash = "";
    return identidadeDaFoto(url.href);
  } catch {
    return null;
  }
}

/** Usa o mesmo parser da exibição, inclusive imagens por referência e links GFM. */
export function fotosDaHistoria(historia: string): Set<string> {
  const fotos = new Set<string>();
  type NoMarkdown = { type: string; url?: string; children?: NoMarkdown[] };
  function visitar(no: NoMarkdown) {
    const identidade = typeof no.url === "string" ? identidadeDaReferencia(no.url) : null;
    if (identidade) fotos.add(identidade);
    for (const filho of no.children ?? []) visitar(filho);
  }
  Markdown({ children: historia, remarkPlugins: [remarkGfm, () => visitar] });
  return fotos;
}
