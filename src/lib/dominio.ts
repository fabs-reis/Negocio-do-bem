// Listas e rótulos usados em formulários e telas.

export const CATEGORIAS = [
  "Alimentação",
  "Café e padaria",
  "Restaurante e bar",
  "Mercado e empório",
  "Moda e acessórios",
  "Beleza e bem-estar",
  "Saúde",
  "Educação",
  "Arte e cultura",
  "Livraria e papelaria",
  "Casa e decoração",
  "Pet",
  "Serviços",
  "Tecnologia",
  "Turismo e hospedagem",
  "Outros",
] as const;

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export const METODOS_REIVINDICACAO: Record<string, string> = {
  instagram_login: "Entrar com Instagram",
  codigo_dm: "Código por DM",
  documento: "Dados do negócio",
};

export const STATUS_REIVINDICACAO: Record<string, string> = {
  pendente: "Em análise",
  aprovada: "Aprovada",
  recusada: "Recusada",
  expirada: "Expirada",
  cancelada: "Cancelada",
};

export const MODERACAO_EMPRESA: Record<string, string> = {
  pendente: "Aguardando moderação",
  aprovada: "Publicada",
  rejeitada: "Não publicada",
};

/** Onde fica o código aberto do projeto. */
export const REPOSITORIO = "https://github.com/fabsreis/Negocio-do-bem";
