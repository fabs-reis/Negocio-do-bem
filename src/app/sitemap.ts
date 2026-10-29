import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { listarParaSitemap } from "@/lib/consultas";
import { ehFotoDoSite } from "@/lib/fotos";
import { urlAbsoluta } from "@/lib/seo";

// Páginas públicas e todos os negócios do diretório, para o Google e o Bing
// acharem cada perfil. O robots.txt aponta para cá.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Lido do banco a cada pedido, como o resto do site: um negócio aprovado
  // entra no sitemap na hora, e um oculto sai na hora.
  await connection();
  const negocios = await listarParaSitemap();
  const ultimaMudanca = negocios[0]?.atualizadoEm;

  return [
    { url: urlAbsoluta("/"), lastModified: ultimaMudanca },
    { url: urlAbsoluta("/explorar"), lastModified: ultimaMudanca },
    { url: urlAbsoluta("/sobre") },
    { url: urlAbsoluta("/indicar") },
    ...negocios.map((negocio) => ({
      url: urlAbsoluta(`/empresas/${negocio.instagramUsername}`),
      lastModified: negocio.atualizadoEm,
      ...(ehFotoDoSite(negocio.fotoUrl) && { images: [urlAbsoluta(negocio.fotoUrl)] }),
    })),
  ];
}
