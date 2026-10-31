-- Cadastro por etapas (#190): telefone comercial do negócio e o contato de quem
-- cadastrou o negócio como dono.
ALTER TABLE "Empresa" ADD COLUMN "telefoneComercial" TEXT,
ADD COLUMN "emailDoDono" TEXT,
ADD COLUMN "telefoneDoDono" TEXT;
