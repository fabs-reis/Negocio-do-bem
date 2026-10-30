-- AlterTable
ALTER TABLE "Reivindicacao" ADD COLUMN     "codigoConfirmadoEm" TIMESTAMP(3),
ADD COLUMN     "enviadoEm" TIMESTAMP(3),
ADD COLUMN     "envios" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reenvioPedidoEm" TIMESTAMP(3),
ADD COLUMN     "tentativas" INTEGER NOT NULL DEFAULT 0;
