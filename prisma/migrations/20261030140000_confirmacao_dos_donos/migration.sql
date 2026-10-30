-- AlterTable
ALTER TABLE "EmpresaMembro" ADD COLUMN     "confirmacaoPedidaEm" TIMESTAMP(3),
ADD COLUMN     "confirmadoEm" TIMESTAMP(3);

-- Contam como confirmados os donos que provaram pelo Instagram (login ou código por
-- DM), como na migração do selo oficial. Quem assumiu pelos dados do negócio fica
-- sem confirmação: o botão de aprovar em lote usava o nome de quem estava na
-- moderação, então a aprovação pela moderação não serve de prova para os antigos.
UPDATE "EmpresaMembro" AS m
SET "confirmadoEm" = COALESCE(r.quando, CURRENT_TIMESTAMP)
FROM (
  SELECT "empresaId", "usuarioId", max("revisadoEm") AS quando
  FROM "Reivindicacao"
  WHERE "status" = 'aprovada' AND "metodo" IN ('instagram_login', 'codigo_dm')
  GROUP BY "empresaId", "usuarioId"
) AS r
WHERE m."empresaId" = r."empresaId" AND m."usuarioId" = r."usuarioId";
