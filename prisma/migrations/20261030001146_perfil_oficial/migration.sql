-- AlterTable
ALTER TABLE "Empresa" ADD COLUMN     "oficial" BOOLEAN NOT NULL DEFAULT false;

-- Os negócios que já existem ganham o selo quando alguém que confirmou pelo
-- Instagram (login ou código por DM) continua dono.
UPDATE "Empresa" AS e
SET "oficial" = true
WHERE EXISTS (
  SELECT 1
  FROM "Reivindicacao" AS r
  JOIN "EmpresaMembro" AS m ON m."empresaId" = r."empresaId" AND m."usuarioId" = r."usuarioId"
  WHERE r."empresaId" = e."id"
    AND r."status" = 'aprovada'
    AND r."metodo" IN ('instagram_login', 'codigo_dm')
);
