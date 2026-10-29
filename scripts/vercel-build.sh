#!/bin/sh
# Build no Vercel. Em produção, aplica as migrações pendentes antes do build,
# para o banco sempre ter as tabelas que o código espera.
set -e

if [ "$VERCEL_ENV" = "production" ]; then
  # Migrações precisam de conexão direta. O Neon fornece DATABASE_URL_UNPOOLED;
  # sem ela, usa a própria DATABASE_URL.
  DATABASE_URL="${DATABASE_URL_UNPOOLED:-$DATABASE_URL}" npx prisma migrate deploy
fi

npx next build
