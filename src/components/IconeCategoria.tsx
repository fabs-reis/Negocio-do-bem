// Um ícone de traço para cada categoria de src/lib/dominio.ts. Categoria nova sem
// ícone aqui usa o de "Outros".
const CAMINHOS: Record<string, string> = {
  Alimentação: "M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 1.5-3 4-3 7h3v11",
  "Café e padaria": "M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9ZM17 11h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3",
  "Restaurante e bar": "M8 3h8l-.5 6a3.5 3.5 0 0 1-7 0L8 3ZM12 13v7M8 21h8",
  "Mercado e empório": "M3 10h18l-2 10H5L3 10ZM8 10l3-6M16 10l-3-6M9 14v3M15 14v3",
  "Moda e acessórios": "M8 3 4 5.5 2.5 10l3 1.5V21h13v-9.5l3-1.5L20 5.5 16 3a4 4 0 0 1-8 0Z",
  "Beleza e bem-estar":
    "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7L19 15Z",
  Saúde: "M20.5 8.5c0 5-8.5 11-8.5 11S3.5 13.5 3.5 8.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 8.5 2.5ZM6.5 12h2.5l1.5-2.5 2.5 5 1.5-2.5h2.5",
  Educação: "M2 9l10-5 10 5-10 5L2 9ZM6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5M22 9v6",
  "Arte e cultura":
    "M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2a4 4 0 0 0 4-4c0-4.1-4-7.4-9-7.4ZM7.5 11.5h.01M10 7.5h.01M15 7.5h.01",
  "Livraria e papelaria": "M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5v-15ZM4 19.5A1.5 1.5 0 0 0 5.5 21H20v-3M8 7h8",
  "Casa e decoração": "M3 11l9-7 9 7M5 9.5V20h14V9.5M10 20v-5h4v5",
  Pet: "M12 13c-3 0-5.5 3-5.5 5 0 1.4 1 2 2.2 2 1.3 0 2-.6 3.3-.6s2 .6 3.3.6c1.2 0 2.2-.6 2.2-2 0-2-2.5-5-5.5-5ZM5 11.2a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6ZM9.5 7.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM14.5 7.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM19 11.2a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Z",
  Serviços: "M4 8h16v11H4V8ZM9 8V5h6v3M4 13h16",
  Tecnologia: "M4 5h16v11H4V5ZM2 19h20",
  "Turismo e hospedagem": "M3 6v14M3 16h18v4M21 16v-3a3 3 0 0 0-3-3h-8v6M6.5 13a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  Outros: "M4 4h6v6H4V4ZM14 4h6v6h-6V4ZM4 14h6v6H4v-6ZM14 14h6v6h-6v-6Z",
};

export function IconeCategoria({ categoria, className = "h-5 w-5" }: { categoria: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={CAMINHOS[categoria] ?? CAMINHOS.Outros} />
    </svg>
  );
}
