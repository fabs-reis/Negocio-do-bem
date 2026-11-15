export const CATEGORIAS_SERVICOS = [
  "Tecnologia", "Design e comunicação", "Marketing", "Construção e reformas",
  "Manutenção e reparos", "Logística e entregas", "Contabilidade e gestão",
  "Educação", "Limpeza", "Fotografia e vídeo", "Alimentação", "Outros",
] as const;

export type CategoriaServico = (typeof CATEGORIAS_SERVICOS)[number];
