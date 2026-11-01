-- Primeira etapa da issue #40 (não aplicada na stage): perfil e catálogo.
CREATE TABLE "PerfilProfissional" (
  "usuarioId" TEXT NOT NULL,
  "nomePublico" TEXT NOT NULL,
  "apresentacao" TEXT NOT NULL,
  "cidade" TEXT NOT NULL,
  "uf" TEXT NOT NULL,
  "remoto" BOOLEAN NOT NULL DEFAULT false,
  "presencial" BOOLEAN NOT NULL DEFAULT false,
  "emailContato" TEXT,
  "site" TEXT,
  "publicado" BOOLEAN NOT NULL DEFAULT false,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PerfilProfissional_pkey" PRIMARY KEY ("usuarioId"),
  CONSTRAINT "PerfilProfissional_modalidade_check" CHECK ("remoto" OR "presencial")
);

CREATE TABLE "Servico" (
  "id" TEXT NOT NULL,
  "perfilUsuarioId" TEXT,
  "empresaId" TEXT,
  "titulo" TEXT NOT NULL,
  "descricao" TEXT NOT NULL,
  "categoria" TEXT NOT NULL,
  "cidade" TEXT NOT NULL,
  "uf" TEXT NOT NULL,
  "remoto" BOOLEAN NOT NULL DEFAULT false,
  "presencial" BOOLEAN NOT NULL DEFAULT false,
  "precoReferencia" TEXT,
  "busca" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'pendente',
  "oculto" BOOLEAN NOT NULL DEFAULT false,
  "motivoRecusa" TEXT,
  "motivoSuspensao" TEXT,
  "moderadoEm" TIMESTAMP(3),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Servico_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Servico_prestador_check" CHECK (
    ("perfilUsuarioId" IS NOT NULL AND "empresaId" IS NULL)
    OR ("perfilUsuarioId" IS NULL AND "empresaId" IS NOT NULL)
  ),
  CONSTRAINT "Servico_modalidade_check" CHECK ("remoto" OR "presencial"),
  CONSTRAINT "Servico_status_check" CHECK ("status" IN ('pendente', 'publicado', 'rejeitado', 'suspenso')),
  CONSTRAINT "Servico_recusa_check" CHECK ("status" <> 'rejeitado' OR "motivoRecusa" IS NOT NULL),
  CONSTRAINT "Servico_suspensao_check" CHECK ("status" <> 'suspenso' OR "motivoSuspensao" IS NOT NULL)
);

CREATE INDEX "PerfilProfissional_publicado_uf_idx" ON "PerfilProfissional"("publicado", "uf");
CREATE INDEX "Servico_status_oculto_criadoEm_idx" ON "Servico"("status", "oculto", "criadoEm");
CREATE INDEX "Servico_status_oculto_categoria_criadoEm_idx" ON "Servico"("status", "oculto", "categoria", "criadoEm");
CREATE INDEX "Servico_perfilUsuarioId_idx" ON "Servico"("perfilUsuarioId");
CREATE INDEX "Servico_empresaId_idx" ON "Servico"("empresaId");
CREATE INDEX "Servico_categoria_uf_idx" ON "Servico"("categoria", "uf");

ALTER TABLE "PerfilProfissional" ADD CONSTRAINT "PerfilProfissional_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Servico" ADD CONSTRAINT "Servico_perfilUsuarioId_fkey"
  FOREIGN KEY ("perfilUsuarioId") REFERENCES "PerfilProfissional"("usuarioId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Servico" ADD CONSTRAINT "Servico_empresaId_fkey"
  FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Municípios atendidos por serviço; preserva a cidade de origem como dado separado.
CREATE TABLE "AreaAtendimentoServico" (
  "servicoId" TEXT NOT NULL,
  "cidade" TEXT NOT NULL,
  "uf" TEXT NOT NULL,
  CONSTRAINT "AreaAtendimentoServico_pkey" PRIMARY KEY ("servicoId", "cidade", "uf")
);
CREATE INDEX "AreaAtendimentoServico_cidade_uf_idx" ON "AreaAtendimentoServico"("cidade", "uf");
ALTER TABLE "AreaAtendimentoServico" ADD CONSTRAINT "AreaAtendimentoServico_servicoId_fkey"
  FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;
