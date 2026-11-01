import { describe, expect, it } from "vitest";
import { observarFila } from "../apoio/cache-cnpj/html.mjs";

const empresa = "Empresa sintética";
const marcador = "RECEITA_SINTETICA";

function ficha(pedido: string, dado = "", trecho = "") {
  return `<article><header>${empresa}</header>${trecho}<span>${dado}</span><form><input name="reivindicacaoId" value="${pedido}"><input name="modo" value="adicionar"></form><form><input name="reivindicacaoId" value="${pedido}"><input name="motivo" value=""></form></article>`;
}

function observar(html: string, pedido: string) {
  return observarFila(html, empresa, pedido, marcador);
}

describe("observador HTTP do cache de CNPJ por ficha", () => {
  it("aceita o dado renderizado em cada ficha completa", () => {
    const html = ficha("pedido-1", marcador) + ficha("pedido-2", marcador);
    for (const pedido of ["pedido-1", "pedido-2"]) {
      expect(observar(html, pedido)).toEqual({ ficha: true, controles: true, marcadorRenderizado: true });
    }
  });

  it("não usa o único marcador da primeira ficha para aprovar a segunda", () => {
    const html = ficha("pedido-1", marcador) + ficha("pedido-2");
    expect(observar(html, "pedido-1").marcadorRenderizado).toBe(true);
    expect(observar(html, "pedido-2")).toEqual({ ficha: true, controles: true, marcadorRenderizado: false });
  });

  it("não troca associação por contagem global quando a ficha errada repete o marcador", () => {
    const html = ficha("pedido-1", `${marcador} ${marcador}`) + ficha("pedido-2");
    expect(observar(html, "pedido-2").marcadorRenderizado).toBe(false);
  });

  it("não aceita o marcador renderizado somente fora das fichas", () => {
    const html = ficha("pedido-1") + `<aside><span>${marcador}</span></aside>`;
    expect(observar(html, "pedido-1").marcadorRenderizado).toBe(false);
  });

  it("não aceita o marcador existente somente em payload RSC", () => {
    const html = ficha("pedido-1") + `<script>self.__next_f.push([1,${JSON.stringify(`<span>${marcador}</span>`)}])</script>`;
    expect(observar(html, "pedido-1").marcadorRenderizado).toBe(false);
  });

  it("associa o segmento concluído do Next somente ao limite da ficha correspondente", () => {
    const html = ficha("pedido-1", "", '<!--$?--><template id="B:1"></template><!--/$-->') +
      ficha("pedido-2", "", '<!--$?--><template id="B:2"></template><!--/$-->') +
      `<div hidden id="S:1"><span>${marcador}</span></div><div hidden id="S:2"><span>Sem o dado esperado</span></div>` +
      '<script>$RC("B:1","S:1")</script><script>$RC("B:2","S:2")</script>';
    expect(observar(html, "pedido-1").marcadorRenderizado).toBe(true);
    expect(observar(html, "pedido-2").marcadorRenderizado).toBe(false);
  });

  it("aceita dados completos nos dois segmentos sem executar os scripts", () => {
    const html = ficha("pedido-1", "", '<template id="B:1"></template>') +
      ficha("pedido-2", "", '<template id="B:2"></template>') +
      `<div hidden id="S:1"><span>${marcador}</span></div><div hidden id="S:2"><span>${marcador}</span></div>` +
      '<script>$RC("B:1","S:1")</script><script>$RC("B:2","S:2")</script>';
    expect(observar(html, "pedido-1").marcadorRenderizado).toBe(true);
    expect(observar(html, "pedido-2").marcadorRenderizado).toBe(true);
  });

  it("recusa uma ficha duplicada em vez de escolher arbitrariamente uma ocorrência", () => {
    const html = ficha("pedido-1", marcador) + ficha("pedido-1", marcador);
    expect(() => observar(html, "pedido-1")).toThrow(/ficha.*unica|ficha.*única/);
  });

  it("falha explicitamente quando o limite não tem segmento correlacionado", () => {
    const html = ficha("pedido-1", "", '<template id="B:1"></template>') + `<div hidden id="S:1"><span>${marcador}</span></div>`;
    expect(() => observar(html, "pedido-1")).toThrow(/segmento.*correlacionado/);
  });

  it("não confunde um identificador apenas fora da ficha com o pedido observado", () => {
    const html = ficha("pedido-1", marcador) + '<input name="reivindicacaoId" value="pedido-2">';
    expect(observar(html, "pedido-2")).toEqual({ ficha: false, controles: false, marcadorRenderizado: false });
  });

  it("não aceita dois pedidos agrupados na mesma ficha com um único dado", () => {
    const html = ficha("pedido-1", marcador).replace("</article>", ficha("pedido-2").replace(/<\/?article>/g, "") + "</article>");
    expect(() => observar(html, "pedido-1")).toThrow(/pedido.*ficha/);
  });

  it("não usa atributo data-name como se fosse o nome do campo", () => {
    const html = ficha("pedido-1", marcador).replaceAll('name="reivindicacaoId"', 'data-name="reivindicacaoId" name="outro"');
    expect(observar(html, "pedido-1")).toEqual({ ficha: false, controles: false, marcadorRenderizado: false });
  });

  it("não interpreta uma instrução serializada no payload RSC como conclusão", () => {
    const html = ficha("pedido-1", "", '<template id="B:1"></template>') + `<div hidden id="S:1"><span>${marcador}</span></div>` +
      `<script>self.__next_f.push([1,${JSON.stringify('$RC("B:1","S:1")')}])</script>`;
    expect(() => observar(html, "pedido-1")).toThrow(/segmento.*correlacionado/);
  });

  it("não presume um protocolo desconhecido de limite como dado completo", () => {
    const html = ficha("pedido-1", marcador, '<template id="B:novo-formato"></template>');
    expect(() => observar(html, "pedido-1")).toThrow(/segmento.*correlacionado/);
  });
});
