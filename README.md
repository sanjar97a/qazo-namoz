# Namoz va Qazo (PWA)

Dunyo bo‘yicha ishlaydi: GPS bo‘yicha aniq joy uchun hisoblaydi, usul davlatga qarab avtomatik tanlanadi (Rossiya, Turkiya, AQSh, Yevropa, Koreya…). O‘zbekistonda islomapi.uz rasmiy taqvimi joyingizga moslab ishlatiladi. Sozlamalarda har bir vaqtni qo‘lda to‘g‘rilash mumkin.

Namoz vaqtlari + avtomatik qazo hisobi. Vaqti tugaguncha "O'qidim" bosilmagan namoz qazo hisobiga +1 bo'ladi. Hisob faqat siz "−" bosganda kamayadi. Ma'lumotlar telefonda (localStorage), internetsiz ishlaydi.

## GitHub Pages'ga joylash
1. github.com → **New repository** → nomi `qazo-namoz` → Public → Create.
2. **Add file → Upload files** → shu papkadagi barcha fayllarni tashlang → Commit.
3. **Settings → Pages** → Source: *Deploy from a branch*, Branch: `main` / `(root)` → Save.
4. 1–2 daqiqadan keyin manzil: `https://sanjar97a.github.io/qazo-namoz/`
5. Telefonda Chrome'da oching → ⋮ → **Bosh ekranga qo'shish**.

## Yangilash
Har yangi versiyada uch joyda raqamni bir xil oshiring: `version.json`, `app.js` dagi `APP_VERSION` va `sw.js` dagi `VERSION`. Telefonlarda “🔄 Yangi versiya mavjud — Yangilash” chiqadi.

## Fayllar
- `index.html` — sahifa va dizayn
- `app.js` — ekranlar (sozlash, bosh sahifa, sozlamalar, zaxira)
- `prayer.js` — namoz vaqtlari (Hanafiy asr) va qazo mantiqi
- `adhan.js` — namoz vaqtlarini hisoblash kutubxonasi (MIT)
- `sw.js`, `manifest.webmanifest`, ikonlar — oflayn ishlash va o'rnatish

## Play Market'ga
Keyinchalik pwabuilder.com saytiga sahifa manzilini kiritib, Android paketini (.aab) yasash mumkin.

## Android ilova (bildirishnomalar bilan)
Har `main` ga push qilinganda GitHub Actions APK yasaydi va **Releases** ga qo'yadi:
`https://github.com/sanjar97a/qazo-namoz/releases/latest/download/namoz-qazo.apk`

Mahalliy: `npm install && npm run sync`, keyin `android/` ni Android Studio'da oching.
`android/app/sideload.keystore` — faqat sinov APK'lari uchun. Play Market uchun alohida maxfiy kalit yarating.
