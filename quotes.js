// Bildirishnomalar uchun qisqa eslatmalar: Qur'on oyatlari ma'nosi va sahih hadislar mazmuni.
// Har biri aniq manba bilan (sura:oyat yoki hadis to'plami). Matnlar so'zma-so'z tarjima emas — ma'no bayoni.

// Namoz vaqti kirganda — rag'bat, shavq
export const START = [
  ['Amallarning Allohga eng suyuklisi — o‘z vaqtida o‘qilgan namozdir.', 'Buxoriy, Muslim'],
  ['Eshigingiz oldida ariq bo‘lsa-yu, kuniga besh marta yuvinsangiz, badaningizda kir qolarmidi? Besh vaqt namoz ham xatolarni shunday yuvadi.', 'Buxoriy, Muslim'],
  ['Meni eslash uchun namozni barpo qil.', 'Toho surasi, 14-oyat'],
  ['Meni yod etinglar — Men ham sizni yod etaman.', 'Baqara surasi, 152-oyat'],
  ['Mo‘minlar najot topdilar — ular namozlarida xushu’ qiluvchilardir.', 'Mu’minun surasi, 1–2-oyatlar'],
  ['Namozga turgan kishi o‘z Robbisi bilan munojot qiladi.', 'Buxoriy'],
  ['Bandaning Robbiga eng yaqin holati — sajdadagi holatidir. Sajdada duoni ko‘paytiring.', 'Muslim'],
  ['Sabr va namoz bilan Allohdan yordam so‘ranglar.', 'Baqara surasi, 45-oyat'],
  ['Albatta, namoz buzuqlik va yomon ishlardan qaytaradi.', 'Ankabut surasi, 45-oyat'],
  ['Payg‘ambarimiz ﷺ: “Ko‘zimning quvonchi namozda qilindi”.', 'Nasoiy'],
  ['Payg‘ambarimiz ﷺ: “Ey Bilol, iqomat ayt, namoz bilan bizni rohatlantir”.', 'Abu Dovud'],
  ['Kim bomdod namozini o‘qisa, u Allohning himoyasidadir.', 'Muslim', ['fajr']],
  ['Kim ikki salqin namozni — bomdod va asrni o‘qisa, jannatga kiradi.', 'Buxoriy, Muslim', ['fajr', 'asr']],
  ['Namozlarni, ayniqsa o‘rta namozni muhofaza qilinglar.', 'Baqara surasi, 238-oyat', ['asr']],
];

// Vaqt tugashidan oldin — ogohlantirish, larza
export const WARN = [
  ['Qiyomat kuni bandadan birinchi so‘raladigan amal — namozdir.', 'Termiziy, Nasoiy'],
  ['Albatta, namoz mo‘minlarga vaqtlari belgilangan holda farz qilingan.', 'Niso surasi, 103-oyat'],
  ['Holiga voy namozxonlarki, ular namozlaridan g‘ofil bo‘lurlar.', 'Mo‘un surasi, 4–5-oyatlar'],
  ['“Sizni do‘zaxga nima kiritdi?” — “Biz namoz o‘quvchilardan bo‘lmagan edik”, deydilar.', 'Muddassir surasi, 42–43-oyatlar'],
  ['Ulardan keyin namozni zoe qilgan va shahvatlarga ergashgan avlodlar keldi…', 'Maryam surasi, 59-oyat'],
  ['Kishi bilan shirk va kufr orasidagi chegara — namozni tark qilishdir.', 'Muslim'],
  ['Amallarning Allohga eng suyuklisi — o‘z vaqtida o‘qilgan namozdir. Vaqt ketmoqda.', 'Buxoriy, Muslim'],
  ['Namozlarni muhofaza qilinglar va Alloh uchun itoatkor holda turinglar.', 'Baqara surasi, 238-oyat'],
];

// Kunlik qazo eslatmasi — tavba, umid
export const QAZO = [
  ['Kim namozni unutsa yoki uxlab qolsa, eslagan zahoti o‘qisin — uning kafforati shudir.', 'Buxoriy, Muslim'],
  ['Kunduzning ikki chekkasida va kechaning bir qismida namozni barpo qil. Albatta, yaxshiliklar yomonliklarni ketkazadi.', 'Hud surasi, 114-oyat'],
  ['Qiyomat kuni bandadan birinchi so‘raladigan amal — namozdir. Bugun bir qadam qo‘ying.', 'Termiziy, Nasoiy'],
  ['Meni yod etinglar — Men ham sizni yod etaman.', 'Baqara surasi, 152-oyat'],
  ['Ahlingni namozga buyur va o‘zing unga sabrli bo‘l.', 'Toho surasi, 132-oyat'],
  ['Sabr va namoz bilan Allohdan yordam so‘ranglar.', 'Baqara surasi, 45-oyat'],
];

// Sana va namozga qarab tanlanadi (har kuni boshqa gap). Uchinchi element bo'lsa — faqat o'sha namozlar uchun.
export function pick(list, seed, prayer) {
  const pool = list.filter((q) => !q[2] || (prayer && q[2].includes(prayer)));
  const n = Math.abs(Math.floor(seed)) % pool.length;
  return pool[n];
}
export const fmtQuote = ([text, ref]) => `«${text}» (${ref})`;
