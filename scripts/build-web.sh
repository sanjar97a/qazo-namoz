#!/usr/bin/env bash
# Veb-ilova fayllarini bitta papkaga yig'adi: GitHub Pages (_site) va Android (www) uchun
#   CHANNEL=web|github|play — ilova qayerdan tarqatilishini belgilaydi (yangilanish usuli shunga bog'liq)
set -euo pipefail
OUT="${1:-www}"
CH="${CHANNEL:-web}"
rm -rf "$OUT" && mkdir -p "$OUT"
cp index.html app.js prayer.js location.js official.js notify.js quotes.js stats.js learn.js qibla.js journey.js geomag.js adhan.js sw.js manifest.webmanifest version.json icon-192.png icon-512.png privacy.html "$OUT"/
printf "export const CHANNEL = '%s';\n" "$CH" > "$OUT/channel.js"
echo "Veb fayllar $OUT ga yig'ildi (kanal: $CH)"
