import { CAUSAS, GRUPOS, type GrupoCausa } from "@/lib/causas";

/** Causas como "chips" marcáveis; funciona sem JavaScript (checkboxes de verdade). */
export function SeletorCausas({ selecionadas = [] }: { selecionadas?: string[] }) {
  const grupos = Object.keys(GRUPOS) as GrupoCausa[];
  return (
    <div className="space-y-4">
      {grupos.map((grupo) => (
        <fieldset key={grupo}>
          <legend className="mb-2 text-xs font-semibold tracking-wide text-suave uppercase">{GRUPOS[grupo]}</legend>
          <div className="flex flex-wrap gap-2">
            {CAUSAS.filter((c) => c.grupo === grupo).map((causa) => (
              <label
                key={causa.slug}
                title={causa.descricao}
                className="flex cursor-pointer items-center gap-1.5 rounded-full border border-linha bg-superficie px-3 py-1.5 text-sm transition select-none hover:border-tinta/25 has-checked:border-coral has-checked:bg-coral-50 has-checked:text-coral-700 has-focus-visible:ring-4 has-focus-visible:ring-coral-100"
              >
                <input
                  type="checkbox"
                  name="causas"
                  value={causa.slug}
                  defaultChecked={selecionadas.includes(causa.slug)}
                  className="sr-only"
                />
                <span aria-hidden="true">{causa.emoji}</span>
                {causa.nome}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
