#!/usr/bin/env bash
# Veb-ilova fayllarini bitta papkaga yig'adi: GitHub Pages (_site) va Android (www) uchun
set -euo pipefail
OUT="${1:-www}"
rm -rf "$OUT" && mkdir -p "$OUT"
cp index.html app.js prayer.js location.js official.js notify.js stats.js adhan.js sw.js manifest.webmanifest version.json icon-192.png icon-512.png "$OUT"/
echo "Veb fayllar $OUT ga yig'ildi"
