import Form from "next/form";
import { CampoOnde } from "@/components/CampoOnde";
import { SEM_FILTROS, slugCategoria, type CidadeComNegocios, type FiltrosDiretorio } from "@/lib/diretorio";

/** Busca por necessidade e lugar, sem perder os filtros que já estão na URL. */
export function BuscaDiretorio({ cidades, filtros = SEM_FILTROS }: { cidades: CidadeComNegocios[]; filtros?: FiltrosDiretorio }) {
  return (
    <Form action="/explorar" role="search" className="flex min-w-0 flex-wrap items-stretch gap-2 rounded-xl border border-borda-controle bg-superficie p-2">
      {filtros.tipos.map((tipo) => <input key={tipo} type="hidden" name="tipo" value={slugCategoria(tipo)} />)}
      {filtros.causas.map((causa) => <input key={causa} type="hidden" name="causa" value={causa} />)}
      {filtros.verificados && <input type="hidden" name="verificados" value="sim" />}
      {filtros.ordem !== SEM_FILTROS.ordem && <input type="hidden" name="ordem" value={filtros.ordem} />}
      {filtros.vista !== SEM_FILTROS.vista && <input type="hidden" name="vista" value={filtros.vista} />}
      <label className="flex min-w-0 flex-[3_1_18rem] cursor-text items-center gap-3 rounded-lg px-3 py-3 transition focus-within:bg-papel">
        <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-tinta" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true"><path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4" /></svg>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xs font-semibold text-suave">O que você procura?</span>
          <input key={filtros.q} type="search" name="q" defaultValue={filtros.q} maxLength={100} placeholder="Padaria, psicóloga, brechó…" className="w-full min-w-0 border-0 bg-transparent p-0 text-base text-tinta placeholder:text-suave focus:outline-none" />
        </span>
      </label>
      <CampoOnde key={filtros.onde} cidades={cidades} valorInicial={filtros.onde} />
      <button type="submit" className="botao-coral min-h-12 flex-[1_0_auto] rounded-lg px-6 text-base sm:flex-[0_0_auto]">
        Buscar
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </button>
    </Form>
  );
}
