-- CreateTable
CREATE TABLE "RedefinicaoSenha" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RedefinicaoSenha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RedefinicaoSenha_usuarioId_idx" ON "RedefinicaoSenha"("usuarioId");

-- AddForeignKey
ALTER TABLE "RedefinicaoSenha" ADD CONSTRAINT "RedefinicaoSenha_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
