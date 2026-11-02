ALTER TABLE "Usuario"
  ADD COLUMN "mfaSegredo" TEXT,
  ADD COLUMN "mfaSegredoPendente" TEXT,
  ADD COLUMN "mfaAtivadoEm" TIMESTAMP(3),
  ADD COLUMN "mfaUltimoPeriodo" INTEGER;

ALTER TABLE "Sessao"
  ADD COLUMN "ultimaAtividadeEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "mfaVerificadoEm" TIMESTAMP(3),
  ADD COLUMN "tentativasMfa" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "MfaCodigoRecuperacao" (
  "hash" TEXT NOT NULL,
  "usuarioId" TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MfaCodigoRecuperacao_pkey" PRIMARY KEY ("hash")
);

CREATE INDEX "MfaCodigoRecuperacao_usuarioId_idx" ON "MfaCodigoRecuperacao"("usuarioId");
ALTER TABLE "MfaCodigoRecuperacao" ADD CONSTRAINT "MfaCodigoRecuperacao_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MfaLimite" (
  "usuarioId" TEXT NOT NULL,
  "contagem" INTEGER NOT NULL,
  "janelaIniciadaEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MfaLimite_pkey" PRIMARY KEY ("usuarioId")
);

ALTER TABLE "MfaLimite" ADD CONSTRAINT "MfaLimite_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
