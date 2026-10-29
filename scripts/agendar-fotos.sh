#!/bin/sh
# Agenda a rotina de fotos (npm run fotos:instagram) para rodar todo dia às 7h
# neste Mac, pelo launchd. Se o Mac estiver desligado ou dormindo no horário,
# ela roda quando ele acordar. O registro fica em ~/Library/Logs/negocio-do-bem-fotos.log.
#
# Uso:     npm run fotos:agendar
# Remover: npm run fotos:agendar -- --remover
set -eu

ROTULO="br.negociodobem.fotos-instagram"
PLIST="$HOME/Library/LaunchAgents/$ROTULO.plist"
REGISTRO="$HOME/Library/Logs/negocio-do-bem-fotos.log"
DOMINIO="gui/$(id -u)"
PROJETO="$(cd "$(dirname "$0")/.." && pwd)"

if [ "${1:-}" = "--remover" ]; then
  launchctl bootout "$DOMINIO" "$PLIST" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Rotina de fotos removida."
  exit 0
fi

if [ ! -f "$PROJETO/.env.fotos" ]; then
  echo "Crie o .env.fotos antes (copie o .env.fotos.example e preencha)."
  exit 1
fi

NPM="$(command -v npm)"
PASTA_NODE="$(dirname "$(command -v node)")"

# Escapa &, < e > para caber no XML do plist.
xml() { printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'; }

mkdir -p "$(dirname "$PLIST")" "$(dirname "$REGISTRO")"
cat > "$PLIST" <<FIM
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$ROTULO</string>
  <key>ProgramArguments</key>
  <array>
    <string>$(xml "$NPM")</string>
    <string>run</string>
    <string>fotos:instagram</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$(xml "$PROJETO")</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$(xml "$PASTA_NODE"):/usr/bin:/bin</string>
  </dict>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>7</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>$(xml "$REGISTRO")</string>
  <key>StandardErrorPath</key>
  <string>$(xml "$REGISTRO")</string>
</dict>
</plist>
FIM

launchctl bootout "$DOMINIO" "$PLIST" 2>/dev/null || true
launchctl bootstrap "$DOMINIO" "$PLIST"
echo "Rotina de fotos agendada para todo dia às 7h."
echo "Rodar agora: launchctl kickstart $DOMINIO/$ROTULO"
echo "Registro:    $REGISTRO"
