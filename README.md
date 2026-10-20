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
Faylni o'zgartirgach, `sw.js` ichidagi `VERSION` ni oshiring (`namoz-qazo-v2`), aks holda telefon eski nusxani ko'rsatadi.

## Fayllar
- `index.html` — sahifa va dizayn
- `app.js` — ekranlar (sozlash, bosh sahifa, sozlamalar, zaxira)
- `prayer.js` — namoz vaqtlari (Hanafiy asr) va qazo mantiqi
- `adhan.js` — namoz vaqtlarini hisoblash kutubxonasi (MIT)
- `sw.js`, `manifest.webmanifest`, ikonlar — oflayn ishlash va o'rnatish

## Play Market'ga
Keyinchalik pwabuilder.com saytiga sahifa manzilini kiritib, Android paketini (.aab) yasash mumkin.
