-- CreateTable
CREATE TABLE "RascunhoCadastro" (
    "usuarioId" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RascunhoCadastro_pkey" PRIMARY KEY ("usuarioId")
);
-- AddForeignKey
ALTER TABLE "RascunhoCadastro" ADD CONSTRAINT "RascunhoCadastro_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
