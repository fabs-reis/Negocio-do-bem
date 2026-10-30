import { DESCRICAO_DO_SITE, NOME_DO_SITE, urlAbsoluta } from "@/lib/seo";

// Catálogo de recursos para agentes de IA (Agentic Resource Discovery - ARD 1.0).
// Permite que agentes e navegadores com WebMCP descubram as capacidades da aplicação.
export function GET() {
  const catalogo = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    specVersion: "1.0",
    host: {
      displayName: NOME_DO_SITE,
      description: DESCRICAO_DO_SITE,
      identifier: "negociodobem.com.br",
      documentationUrl: urlAbsoluta("/sobre"),
      logoUrl: urlAbsoluta("/icones/icone-512.png"),
    },
    entries: [
      {
        identifier: "urn:ai:negociodobem:diretorio:busca",
        displayName: "Busca no Diretório Negócio do Bem",
        type: "application/x.webmcp+json",
        url: urlAbsoluta("/explorar"),
        description: "Permite que agentes pesquisem negócios com impacto socioambiental positivo por nome, categoria, causa e localização.",
      },
      {
        identifier: "urn:ai:negociodobem:docs:llmstxt",
        displayName: "Documentação LLMs.txt",
        type: "text/markdown",
        url: urlAbsoluta("/llms.txt"),
        description: "Visão geral e estrutura do diretório para modelos de linguagem e agentes de IA.",
      },
      {
        identifier: "urn:ai:negociodobem:sitemap",
        displayName: "Sitemap dos Negócios",
        type: "application/xml",
        url: urlAbsoluta("/sitemap.xml"),
        description: "Lista completa de todos os perfis de negócios e páginas do diretório.",
      },
    ],
  };

  return Response.json(catalogo, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
