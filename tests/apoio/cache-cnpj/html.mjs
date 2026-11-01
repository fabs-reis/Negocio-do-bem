export function exigir(condicao, codigo) {
  if (!condicao) throw new Error(`[HARNESS37] ${codigo}`);
}
export function decodificar(valor) {
  const entidades = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">" };
  return valor.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|quot|apos|lt|gt);/gi, (_, entidade) => {
    if (entidade.startsWith("#x")) return String.fromCodePoint(parseInt(entidade.slice(2), 16));
    if (entidade.startsWith("#")) return String.fromCodePoint(parseInt(entidade.slice(1), 10));
    return entidades[entidade.toLowerCase()];
  });
}
export function atributo(tag, nome) {
  const resultado = tag.match(new RegExp(`(?:^|\\s)${nome}=(?:"([^"]*)"|'([^']*)')`, "i"));
  return resultado ? decodificar(resultado[1] ?? resultado[2] ?? "") : undefined;
}
export function formularioDeEntrada(html, pagina) {
  const candidatos = [...html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)]
    .map((trecho) => ({ atributos: trecho[1], entradas: [...trecho[2].matchAll(/<input\b[^>]*>/gi)].map(m => m[0]) }))
    .filter(({ entradas }) => {
      const nomes = entradas.map(tag => atributo(tag, "name"));
      return nomes.includes("email") && nomes.includes("senha");
    });
  exigir(candidatos.length === 1, "formulario-entrada-unico");
  const formulario = candidatos[0];
  exigir(atributo(formulario.atributos, "method")?.toLowerCase() === "post", "metodo-formulario");
  const destino = new URL(atributo(formulario.atributos, "action") || pagina, pagina);
  exigir(destino.origin === new URL(pagina).origin, "destino-formulario");
  const dados = new FormData();
  for (const tag of formulario.entradas) {
    const nome = atributo(tag, "name");
    if (nome && atributo(tag, "type")?.toLowerCase() === "hidden") dados.append(nome, atributo(tag, "value") ?? "");
  }
  exigir([...dados.keys()].filter(nome => /^\$ACTION_(?:ID|REF)_/.test(nome)).length === 1, "seletor-server-action");
  return { destino, dados };
}
export function sanitizarHtml(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "<!-- script omitido -->")
    .replace(/<input\b[^>]*>/gi, tag => {
      const nome = atributo(tag, "name");
      if (!nome?.startsWith("$ACTION")) return tag;
      return tag.replace(/\bvalue=(?:"[^"]*"|'[^']*')/gi, 'value="[omitido]"');
    });
}
function elementos(html, nome) {
  const encontrados = [];
  const abertos = [];
  const tags = new RegExp(`<${nome}\\b[^>]*>|<\\/${nome}\\s*>`, "gi");
  for (const tag of html.matchAll(tags)) {
    if (!tag[0].startsWith("</")) abertos.push({ abertura: tag[0], inicio: tag.index + tag[0].length });
    else {
      const aberto = abertos.pop();
      exigir(aberto, `estrutura-${nome}`);
      encontrados.push({ abertura: aberto.abertura, corpo: html.slice(aberto.inicio, tag.index) });
    }
  }
  exigir(abertos.length === 0, `estrutura-${nome}`);
  return encontrados;
}

function pedidoNoFormulario(formulario, pedido) {
  return [...formulario.corpo.matchAll(/<input\b[^>]*>/gi)]
    .some(tag => atributo(tag[0], "name") === "reivindicacaoId" && atributo(tag[0], "value") === pedido);
}

/** Lê apenas a instrução de conclusão emitida pelo React instalado, sem executar JavaScript. */
function segmentosConcluidos(html) {
  const pares = new Map();
  for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const tipo = atributo(script[1], "type");
    if (tipo && !/^(?:text|application)\/javascript$/i.test(tipo)) continue;
    const chamada = script[2].match(/\$RC\("([\w:.-]*B:[0-9a-f]+)","([\w:.-]*S:[0-9a-f]+)"\)\s*;?\s*$/);
    if (!chamada) continue;
    const prefixo = script[2].slice(0, chamada.index).trim();
    if (prefixo && !prefixo.startsWith("$RB=[];$RV=function(")) continue;
    exigir(chamada[2] === chamada[1].replace(/B:([0-9a-f]+)$/, "S:$1"), "segmento-correlacionado");
    exigir(!pares.has(chamada[1]), "segmento-correlacionado-unico");
    pares.set(chamada[1], chamada[2]);
  }
  return pares;
}

export function observarFila(html, empresa, pedido, marcador) {
  const renderizado = sanitizarHtml(html).replace(/<!--[\s\S]*?-->/g, "");
  const fichas = elementos(renderizado, "article").filter(ficha =>
    elementos(ficha.corpo, "form").some(formulario => pedidoNoFormulario(formulario, pedido)));
  exigir(fichas.length <= 1, "ficha-unica");
  if (!fichas.length) return { ficha: false, controles: false, marcadorRenderizado: false };
  const ficha = fichas[0];
  const ids = [...ficha.corpo.matchAll(/<input\b[^>]*>/gi)].map(tag => tag[0])
    .filter(tag => atributo(tag, "name") === "reivindicacaoId").map(tag => atributo(tag, "value"));
  exigir(ids.every(id => id === pedido), "pedido-pertence-a-uma-ficha");
  const formularios = elementos(ficha.corpo, "form").filter(formulario => pedidoNoFormulario(formulario, pedido));
  const controles = ["modo", "motivo"].every(nome => formularios.some(formulario =>
    [...formulario.corpo.matchAll(/<input\b[^>]*>/gi)].some(tag => atributo(tag[0], "name") === nome)));
  const pares = segmentosConcluidos(html);
  const segmentos = elementos(renderizado, "div");
  let dados = ficha.corpo;
  for (const limite of ficha.corpo.matchAll(/<template\b[^>]*>/gi)) {
    const id = atributo(limite[0], "id");
    if (!id || !id.includes("B:")) continue;
    exigir(/^[\w:.-]*B:[0-9a-f]+$/.test(id), "segmento-correlacionado-formato");
    exigir(pares.has(id), "segmento-correlacionado-a-ficha");
    const encontrados = segmentos.filter(segmento => atributo(segmento.abertura, "id") === pares.get(id) && /\shidden(?:\s|=|>)/.test(segmento.abertura));
    exigir(encontrados.length === 1, "segmento-correlacionado-unico");
    dados += encontrados[0].corpo;
  }
  return {
    ficha: decodificar(ficha.corpo.replace(/<[^>]*>/g, "")).includes(empresa),
    controles,
    marcadorRenderizado: elementos(dados, "span").some(trecho =>
      decodificar(trecho.corpo.replace(/<[^>]*>/g, "")).includes(marcador)),
  };
}
