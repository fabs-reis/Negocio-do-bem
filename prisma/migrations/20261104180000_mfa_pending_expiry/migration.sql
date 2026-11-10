-- Enrolamentos pendentes anteriores devem ser reiniciados antes de confirmar o MFA.
ALTER TABLE "Usuario" ADD COLUMN "mfaPendenteCriadoEm" TIMESTAMP(3);
