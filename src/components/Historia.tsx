import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ehFotoDoSite } from "@/lib/fotos";

/**
 * Renderiza a história em Markdown. HTML cru é ignorado (react-markdown não
 * executa HTML por padrão), então o texto do dono não consegue injetar scripts.
 * Imagens só aparecem se foram enviadas pelo próprio site.
 */
export function Historia({ markdown }: { markdown: string }) {
  return (
    <div className="historia">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h2>{children}</h2>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="nofollow ugc noopener noreferrer">
              {children}
            </a>
          ),
          // Só fotos enviadas pelo site. O texto entre colchetes vira legenda,
          // como no Substack. Spans em vez de figure, porque a imagem fica dentro de um <p>.
          img: ({ src, alt }) =>
            typeof src === "string" && ehFotoDoSite(src) ? (
              <span className="foto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={alt ?? ""} loading="lazy" />
                {alt && <span className="legenda">{alt}</span>}
              </span>
            ) : null,
        }}
      >
        {markdown}
      </Markdown>
    </div>
  );
}
