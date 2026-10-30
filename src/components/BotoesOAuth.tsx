"use client";

import type { ReactNode } from "react";

type Provedor = {
  id: string;
  nome: string;
  estilo: string;
  icone: ReactNode;
  disponivel: boolean; // Flag para indicar se o fluxo está ativo
};

const PROVEDORES: Provedor[] = [
  {
    id: "google",
    nome: "Google",
    estilo: "bg-white border border-gray-300 text-gray-700",
    disponivel: false, // Altere para true quando conectar o Supabase/Auth
    icone: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-6 h-6">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      </svg>
    )
  },
  {
    id: "facebook",
    nome: "Facebook",
    estilo: "bg-[#1877F2] text-white border-transparent",
    disponivel: false,
    icone: (
      <svg fill="currentColor" viewBox="0 0 24 24" className="w-7 h-7">
        <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H7v-3h3V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z" />
      </svg>
    )
  },
  {
    id: "instagram",
    nome: "Instagram",
    estilo: "bg-gradient-to-tr from-[#FFDC80] via-[#FD1D1D] to-[#833AB4] text-white border-transparent",
    disponivel: false,
    icone: (
      <svg fill="currentColor" viewBox="0 0 24 24" className="w-6 h-6">
        <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.46 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
      </svg>
    )
  },
  {
    id: "govbr",
    nome: "gov.br",
    estilo: "bg-[#1351B4] text-white border-transparent",
    disponivel: false,
    icone: (
      <svg viewBox="0 0 100 100" className="w-9 h-9" xmlns="http://www.w3.org/2000/svg">
        <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle" fontFamily="Montserrat, sans-serif" fontWeight="900" fontSize="32" fill="#ffffff" letterSpacing="-1">
          gov<tspan fill="#FFCD00">.</tspan>br
        </text>
      </svg>
    )
  },
];

export function BotoesOAuth() {
  const lidarComLogin = async (idProvedor: string) => {
    console.log(`Iniciando fluxo OAuth para: ${idProvedor}`);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-row justify-center gap-4">
        {PROVEDORES.map((prov) => (
          <button
            key={prov.id}
            type="button"
            disabled={!prov.disponivel}
            onClick={() => lidarComLogin(prov.id)}
            title={prov.disponivel ? `Continuar com ${prov.nome}` : `${prov.nome} (Em breve)`}
            aria-label={`Continuar com ${prov.nome}`}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 ${
              prov.disponivel
                ? `cursor-pointer hover:-translate-y-1 hover:shadow-md ${prov.estilo}`
                : "cursor-not-allowed opacity-40 grayscale"
            }`}
          >
            {prov.icone}
          </button>
        ))}
      </div>
      <p className="text-xs text-suave">Login social (em breve)</p>
    </div>
  );
}