import { IconeRede } from "@/components/IconeRede";

/** Alvos de toque amplos, seleção nativa por teclado e indicação visual de foco. */
export function SeletorModalidades({
  remoto,
  presencial,
  erro,
}: {
  remoto: boolean;
  presencial: boolean;
  erro?: string;
}) {
  return (
    <fieldset>
      <legend className="rotulo">Modalidade de atendimento</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border border-linha bg-papel/60 px-4 py-3 transition hover:border-coral/60 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-coral has-checked:border-coral has-checked:bg-coral-50">
          <input name="remoto" type="checkbox" value="sim" defaultChecked={remoto} className="h-4 w-4 shrink-0 accent-coral" />
          <IconeRede nome="remoto" className="h-5 w-5 shrink-0 text-coral-700" />
          <span className="text-sm font-medium">Remoto</span>
        </label>
        <label className="flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border border-linha bg-papel/60 px-4 py-3 transition hover:border-coral/60 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-coral has-checked:border-coral has-checked:bg-coral-50">
          <input name="presencial" type="checkbox" value="sim" defaultChecked={presencial} className="h-4 w-4 shrink-0 accent-coral" />
          <IconeRede nome="presencial" className="h-5 w-5 shrink-0 text-coral-700" />
          <span className="text-sm font-medium">Presencial</span>
        </label>
      </div>
      {erro && <p className="erro-campo" role="alert">{erro}</p>}
    </fieldset>
  );
}
