#!/bin/sh
# Build no Vercel. Em produção e nos previews, aplica as migrações pendentes
# antes do build, para o banco sempre ter as tabelas que o código espera.
# O Preview tem um banco Neon separado da produção. A configuração do Prisma
# seleciona um esquema por deployment, tanto aqui quanto no runtime.
set -e

case "$VERCEL_ENV" in
  production | preview)
    # Migrações precisam de conexão direta. O Neon fornece DATABASE_URL_UNPOOLED;
    # sem ela, usa a própria DATABASE_URL.
    DATABASE_URL="${DATABASE_URL_UNPOOLED:-$DATABASE_URL}" npx prisma migrate deploy
    ;;
esac

if [ "$VERCEL_ENV" = "preview" ]; then
  # Dados de exemplo para homologar, só no esquema vazio deste deployment.
  npx prisma db seed
fi

npx next build
