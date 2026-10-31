import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ImageResponse } from "next/og";
import { FONTES, ImagemDoSite, LogoNaImagem, SUAVE, TAMANHO } from "@/lib/compartilhamento";
import { cidadeDoSlug } from "@/lib/consultas";
import { fotoDaCidade } from "@/lib/fotos-das-cidades";
import { CORES_DA_MARCA } from "@/lib/marca";

// Prévia do link de uma cidade: a foto de cartão-postal, quando ela tem, com
// "Negócios do bem em Salvador, BA" e quantos negócios há. Sem foto, o mesmo texto
// no creme da marca. Endereço sem cidade no diretório leva a imagem geral do site.
export const alt = "Negócios do bem de uma cidade, no Negócio do Bem";
export const size = TAMANHO;
export const contentType = "image/png";

export default async function Imagem({ params }: { params: Promise<{ cidade: string }> }) {
  const cidade = await cidadeDoSlug((await params).cidade);
  if (!cidade) return new ImageResponse(<ImagemDoSite />, { ...TAMANHO, fonts: FONTES });

  const nome = `${cidade.cidade}, ${cidade.uf}`;
  const quantos = `${cidade.total.toLocaleString("pt-BR")} ${cidade.total === 1 ? "negócio" : "negócios"} no diretório`;
  const registro = fotoDaCidade(cidade.cidade, cidade.uf);
  // A versão pequena basta para a prévia e pesa menos para o gerador da imagem.
  const foto = registro && (await fotoEmDataUri(registro.srcPequena));
  const tamanhoDoNome = nome.length > 22 ? 76 : nome.length > 15 ? 92 : 108;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          position: "relative",
          width: "100%",
          height: "100%",
          background: CORES_DA_MARCA.creme,
          borderBottom: `14px solid ${CORES_DA_MARCA.laranja}`,
        }}
      >
        {foto && (
          <img
            src={foto}
            width={TAMANHO.width}
            height={TAMANHO.height}
            alt=""
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        {foto && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundImage: "linear-gradient(to top, rgba(45, 37, 29, 0.88) 0%, rgba(45, 37, 29, 0.45) 45%, rgba(45, 37, 29, 0) 75%)",
            }}
          />
        )}

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", padding: "48px 72px 56px" }}>
          <div style={{ display: "flex" }}>
            <div style={{ display: "flex", padding: foto ? "16px 28px" : 0, borderRadius: 999, background: foto ? CORES_DA_MARCA.creme : "transparent" }}>
              <LogoNaImagem largura={foto ? 250 : 290} />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: "Inter", fontSize: 34, color: foto ? CORES_DA_MARCA.creme : SUAVE }}>Negócios do bem em</div>
            <div
              style={{
                marginTop: 6,
                fontFamily: "Newsreader",
                fontSize: tamanhoDoNome,
                lineHeight: 1.04,
                color: foto ? "#ffffff" : CORES_DA_MARCA.marrom,
              }}
            >
              {nome}
            </div>
            <div style={{ display: "flex", marginTop: 26 }}>
              <div
                style={{
                  display: "flex",
                  padding: "10px 24px",
                  borderRadius: 999,
                  background: CORES_DA_MARCA.laranja,
                  color: "#ffffff",
                  fontFamily: "Inter",
                  fontSize: 28,
                }}
              >
                {quantos}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...TAMANHO, fonts: FONTES },
  );
}

type Ativos = { fetch(url: string): Promise<Response> };

/**
 * A foto da cidade como data URI. No Cloudflare, os arquivos de public/ não estão
 * no disco do Worker: vêm do binding ASSETS. Sem a foto, a prévia sai sem ela.
 */
async function fotoEmDataUri(caminho: string): Promise<string | null> {
  try {
    let dados: Buffer;
    if (process.env.CLOUDFLARE_DEPLOY === "1") {
      const ativos = (getCloudflareContext().env as unknown as { ASSETS: Ativos }).ASSETS;
      const resposta = await ativos.fetch(new URL(caminho, "https://ativos.local").toString());
      if (!resposta.ok) return null;
      dados = Buffer.from(await resposta.arrayBuffer());
    } else {
      dados = await readFile(join(process.cwd(), "public", caminho));
    }
    return `data:image/jpeg;base64,${dados.toString("base64")}`;
  } catch {
    return null;
  }
}
