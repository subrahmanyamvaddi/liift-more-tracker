#!/bin/sh
# Renders the PNG app icons from public/icon.svg.
# Needs rsvg-convert (`brew install librsvg` or `apt install librsvg2-bin`).
set -e
cd "$(dirname "$0")/.."
for spec in pwa-192:192 pwa-512:512 apple-touch-icon:180 favicon:64; do
  size="${spec#*:}"
  rsvg-convert -w "$size" -h "$size" public/icon.svg -o "public/${spec%%:*}.png"
done
