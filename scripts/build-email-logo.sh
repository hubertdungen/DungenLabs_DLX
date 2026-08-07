#!/usr/bin/env bash
#
# Gera images/brand/dlx-email-header.png a partir da marca DL X.
#
# Porque e que isto existe: os clientes de email nao renderizam SVG —
# nem o Gmail, nem o Outlook, nem o Apple Mail. Todos os logotipos do
# projecto sao SVG, por isso o cabecalho do email precisa de um PNG.
#
# E porque e que usa o Firefox: esta maquina nao tem rasterizador
# nenhum. Sem ImageMagick, sem rsvg-convert, sem Inkscape, sem PIL,
# sem cairosvg. O Firefox em headless faz o trabalho e ja ca esta.
#
# Duas armadilhas, ambas encontradas a serio:
#
#   1. O Firefox aqui e um snap, e um snap nao consegue ler directorios
#      ocultos ($HOME/.qualquer-coisa) nem /srv. Por isso o trabalho
#      passa por uma pasta visivel em $HOME e o resultado e copiado
#      para o repositorio no fim.
#
#   2. Um Firefox morto deixa um lock no perfil e a execucao seguinte
#      falha com "Firefox is already running". Daqui o perfil
#      descartavel, criado de novo em cada corrida.
#
# Correr a partir da raiz do repositorio:
#
#     bash scripts/build-email-logo.sh
#
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$HOME/.dlx-email-logo-build"
DEST="$REPO/images/brand/dlx-email-header.png"

# 1200x300 e o dobro dos 600x150 que o email mostra, para ecras retina.
WIDTH=1200
HEIGHT=300

rm -rf "$WORK"
mkdir -p "$WORK/profile"

cat > "$WORK/header.html" <<'HTML'
<!doctype html><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;width:1200px;height:300px;background:#12373F;}
  .wrap{width:1200px;height:300px;display:flex;align-items:center;justify-content:center;}
  svg{display:block;height:170px;width:auto;}
</style>
<div class="wrap">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="274 383 745 513">
  <path fill="#FFFFFF" d="M426.43,394.71h-140.66v375.51h235.5v-268.41l-94.85-107.11ZM426.43,675.37h-45.81v-185.82h45.81v185.82Z"/>
  <polygon fill="#EB826C" points="521.28 788.93 521.28 596.66 426.43 489.55 426.43 788.93 426.43 883.78 521.28 883.78 699.36 883.78 699.36 788.93 521.28 788.93"/>
  <path fill="#EB826C" d="M1006.26,832.53h-79.87s-40.39-41.13-40.39-41.13l-44.71-45.96-28.35,29.11-66.72,68.41-30.51,30.66-.21-101.85-39.92-.14c-.51-3.83-.69-7.22.03-10.23l44.31-45.3,37.57-38.47c3.49-3.57,6.83-6.55,10.03-10.83l-59.03-60.39-33.32-33.94.07-66.07h87.27s21.41,22.01,21.41,22.01l8.67,9.12,48.62,50.94,18.68-19.82,29.72-31.01,30.09-31.21,86.56-.04-.02,66.51-54.67,56.19-37.06,37.92c4.04,4.73,7.83,8.65,12,12.88l26.85,27.24,48.17,48.95,4.71,5.05.04,71.4Z"/>
</svg>
</div>
HTML

echo "a rasterizar com o Firefox headless (demora ~30s na primeira vez)…"
timeout 300 firefox --headless \
  -profile "$WORK/profile" \
  --screenshot "$WORK/out.png" \
  --window-size="$WIDTH,$HEIGHT" \
  "file://$WORK/header.html" 2>&1 | grep -v 'headless mode' || true

if [ ! -s "$WORK/out.png" ]; then
  echo "falhou: o Firefox nao produziu imagem" >&2
  exit 1
fi

cp "$WORK/out.png" "$DEST"
rm -rf "$WORK"
echo "escrito $DEST ($(stat -c%s "$DEST") bytes)"
