/**
 * Reduz a foto no navegador antes do envio: fica leve para quem lê pelo celular
 * e cabe no limite de envio. Sai sempre em JPEG, com fundo branco para imagens
 * com transparência. Com `quadrada`, recorta o centro.
 */
export async function reduzirFoto(arquivo: File, { lado, quadrada = false }: { lado: number; quadrada?: boolean }): Promise<File> {
  const imagem = await createImageBitmap(arquivo);
  const recorte = quadrada ? Math.min(imagem.width, imagem.height) : null;
  const larguraOrigem = recorte ?? imagem.width;
  const alturaOrigem = recorte ?? imagem.height;
  const escala = Math.min(1, lado / Math.max(larguraOrigem, alturaOrigem));
  const largura = Math.round(larguraOrigem * escala);
  const altura = Math.round(alturaOrigem * escala);

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const contexto = canvas.getContext("2d");
  if (!contexto) throw new Error("Canvas indisponível.");
  contexto.fillStyle = "#fff";
  contexto.fillRect(0, 0, largura, altura);
  const x = recorte ? (imagem.width - recorte) / 2 : 0;
  const y = recorte ? (imagem.height - recorte) / 2 : 0;
  contexto.drawImage(imagem, x, y, larguraOrigem, alturaOrigem, 0, 0, largura, altura);
  imagem.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("Não foi possível preparar a foto.");
  return new File([blob], "foto.jpg", { type: "image/jpeg" });
}
