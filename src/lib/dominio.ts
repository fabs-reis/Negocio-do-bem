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

export type Uf = (typeof UFS)[number];

export const NOMES_UF: Record<Uf, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal",
  ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul",
  MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí",
  RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima",
  SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

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
