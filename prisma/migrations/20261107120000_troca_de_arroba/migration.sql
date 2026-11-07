-- CreateTable
CREATE TABLE "TrocaDeArroba" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "arrobaAntigo" TEXT NOT NULL,
    "arrobaNovo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "motivo" TEXT,
    "decididoPorId" TEXT,
    "decididoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrocaDeArroba_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrocaDeArroba_status_criadoEm_idx" ON "TrocaDeArroba"("status", "criadoEm");

-- CreateIndex
CREATE INDEX "TrocaDeArroba_empresaId_status_idx" ON "TrocaDeArroba"("empresaId", "status");

-- CreateIndex
CREATE INDEX "TrocaDeArroba_usuarioId_idx" ON "TrocaDeArroba"("usuarioId");

-- AddForeignKey
ALTER TABLE "TrocaDeArroba" ADD CONSTRAINT "TrocaDeArroba_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrocaDeArroba" ADD CONSTRAINT "TrocaDeArroba_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrocaDeArroba" ADD CONSTRAINT "TrocaDeArroba_decididoPorId_fkey" FOREIGN KEY ("decididoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

