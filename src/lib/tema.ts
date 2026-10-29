// Modo claro ou escuro. A escolha fica no localStorage do navegador; sem
// escolha, o site segue o tema do sistema. O <html> recebe data-tema, e as
// cores do globals.css mudam a partir dele.

export type Tema = "claro" | "escuro";

export const CHAVE_TEMA = "tema";

/** Tema salvo ou, sem escolha, o do sistema. Só funciona no navegador. */
export function temaPreferido(): Tema {
  try {
    const salvo = localStorage.getItem(CHAVE_TEMA);
    if (salvo === "claro" || salvo === "escuro") return salvo;
  } catch {
    // localStorage bloqueado: segue o sistema.
  }
  return matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
}

/** Roda no <head> antes da primeira pintura, para a página não piscar no tema errado. Mesma regra de temaPreferido. */
export const SCRIPT_TEMA = `(function(){var t;try{t=localStorage.getItem("${CHAVE_TEMA}")}catch(e){}if(t!=="claro"&&t!=="escuro")t=matchMedia("(prefers-color-scheme: dark)").matches?"escuro":"claro";document.documentElement.setAttribute("data-tema",t)})()`;
