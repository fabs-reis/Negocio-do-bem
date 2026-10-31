#!/bin/sh
# Deploy Cloudflare: migra o banco do ambiente antes do build do Worker.
#
# No Workers Builds, as variáveis de build de produção e as dos previews ficam em
# abas diferentes do painel, e um engano ali levaria a migração de um PR ao banco
# de produção. Por isso o ambiente vem da branch (WORKERS_CI_BRANCH), e não do
# DEPLOY_ENV: só a main é produção. As outras usam as variáveis PREVIEW_*, e o
# build falha se faltar alguma, em vez de cair nas de produção. Assim, a migração
# de um PR ainda não aprovado nunca chega ao banco de produção.
# Fora do Workers Builds (npm run preview:cloudflare ou deploy:cloudflare), vale
# o DEPLOY_ENV.
set -e

if [ -n "$WORKERS_CI_BRANCH" ]; then
  if [ "$WORKERS_CI_BRANCH" = "main" ]; then
    DEPLOY_ENV=production
  else
    DEPLOY_ENV=preview
    for variavel in PREVIEW_DATABASE_URL PREVIEW_APP_URL PREVIEW_R2_PUBLIC_URL; do
      eval "valor=\${$variavel}"
      if [ -z "$valor" ]; then
        echo "Falta a variável de build $variavel para o preview da branch $WORKERS_CI_BRANCH." >&2
        exit 1
      fi
    done
    DATABASE_URL="$PREVIEW_DATABASE_URL"
    DATABASE_URL_UNPOOLED="$PREVIEW_DATABASE_URL_UNPOOLED"
    APP_URL="$PREVIEW_APP_URL"
    NEXT_PUBLIC_R2_PUBLIC_URL="$PREVIEW_R2_PUBLIC_URL"
  fi
  export DEPLOY_ENV DATABASE_URL DATABASE_URL_UNPOOLED APP_URL NEXT_PUBLIC_R2_PUBLIC_URL
fi

# A identidade pertence ao artefato, não à branch nem ao ambiente de runtime.
if [ "$DEPLOY_ENV" = "preview" ]; then
  BANCO_PREVIEW_ID="$(node -e 'process.stdout.write(require("node:crypto").randomUUID())')"
  export BANCO_PREVIEW_ID
fi
node -e 'require("node:fs").writeFileSync("public/banco-preview.json", JSON.stringify(process.env.DEPLOY_ENV === "preview" ? { id: process.env.BANCO_PREVIEW_ID } : {}) + "\n")'

case "$DEPLOY_ENV" in
  production | preview)
    # Migrações precisam de conexão direta. O Neon fornece DATABASE_URL_UNPOOLED;
    # sem ela, vale a DATABASE_URL, do ambiente ou do .env.
    if [ -n "$DATABASE_URL_UNPOOLED" ]; then
      DATABASE_URL="$DATABASE_URL_UNPOOLED" npx prisma migrate deploy
    else
      npx prisma migrate deploy
    fi
    ;;
esac

if [ "$DEPLOY_ENV" = "preview" ]; then
  # Dados de exemplo para homologar. Em deploy, o seed só preenche um banco vazio.
  npx prisma db seed
fi

# O Prisma compila o seu WebAssembly ao carregar, e o Workers proíbe isso
# ("Wasm code generation disallowed by embedder"). Para o Worker, o cliente é
# gerado com runtime = "cloudflare", que importa o WASM como módulo. O schema
# não muda: o Node (dev e testes) continua com o cliente padrão, regerado no fim.
sed 's|^\( *output *= .*\)$|\1\n  runtime  = "cloudflare"|' prisma/schema.prisma > prisma/schema.cloudflare.prisma
trap 'rm -f prisma/schema.cloudflare.prisma; npx prisma generate > /dev/null' EXIT
npx prisma generate --schema prisma/schema.cloudflare.prisma

npx opennextjs-cloudflare build
