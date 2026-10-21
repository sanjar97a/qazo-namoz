// Bildirishnomalar uchun qisqa eslatmalar: Qur'on oyatlari ma'nosi va sahih hadislar mazmuni.
// Matnlar so'zma-so'z tarjima emas — ma'no bayoni. Oyatlarning arabcha asl matni ilovada Quran.com
// ochiq bazasidan olinadi; hadislar uchun sunnah.com havolasi beriladi.
//
// Har bir yozuv: { id, text, ref, ayah?: [sura, birinchiOyat, oxirgiOyat], hadith?: [{ name, url }], only?: [namozlar] }

const Q = (id, text, ref, ayah, only) => ({ id, text, ref, ayah, only });
const H = (id, text, ref, hadith, only) => ({ id, text, ref, hadith, only });
const sn = (book, n) => ({ name: `${{ bukhari: 'Buxoriy', muslim: 'Muslim', tirmidhi: 'Termiziy', nasai: 'Nasoiy', abudawud: 'Abu Dovud' }[book]}, ${n}`, url: `https://sunnah.com/${book}:${n}` });

// Namoz vaqti kirganda — rag'bat, shavq
export const START = [
  H('h-ontime', 'Amallarning Allohga eng suyuklisi — o‘z vaqtida o‘qilgan namozdir.', 'Buxoriy, Muslim', [sn('bukhari', 527), sn('muslim', 85)]),
  H('h-river', 'Eshigingiz oldida ariq bo‘lsa-yu, kuniga besh marta yuvinsangiz, badaningizda kir qolarmidi? Besh vaqt namoz ham xatolarni shunday yuvadi.', 'Buxoriy, Muslim', [sn('bukhari', 528), sn('muslim', 667)]),
  Q('q-20-14', 'Meni eslash uchun namozni barpo qil.', 'Toho surasi, 14-oyat', [20, 14, 14]),
  Q('q-2-152', 'Meni yod etinglar — Men ham sizni yod etaman.', 'Baqara surasi, 152-oyat', [2, 152, 152]),
  Q('q-23-1', 'Mo‘minlar najot topdilar — ular namozlarida xushu’ qiluvchilardir.', 'Mu’minun surasi, 1–2-oyatlar', [23, 1, 2]),
  H('h-sajda', 'Bandaning Robbiga eng yaqin holati — sajdadagi holatidir. Sajdada duoni ko‘paytiring.', 'Muslim', [sn('muslim', 482)]),
  Q('q-2-45', 'Sabr va namoz bilan Allohdan yordam so‘ranglar.', 'Baqara surasi, 45-oyat', [2, 45, 45]),
  Q('q-29-45', 'Albatta, namoz buzuqlik va yomon ishlardan qaytaradi.', 'Ankabut surasi, 45-oyat', [29, 45, 45]),
  H('h-qurra', 'Payg‘ambarimiz ﷺ: “Ko‘zimning quvonchi namozda qilindi”.', 'Nasoiy', [sn('nasai', 3939)]),
  H('h-bilal', 'Payg‘ambarimiz ﷺ: “Ey Bilol, iqomat ayt, namoz bilan bizni rohatlantir”.', 'Abu Dovud', [sn('abudawud', 4985)]),
  H('h-fajr', 'Kim bomdod namozini o‘qisa, u Allohning himoyasidadir.', 'Muslim', [sn('muslim', 657)], ['fajr']),
  H('h-bardain', 'Kim ikki salqin namozni — bomdod va asrni o‘qisa, jannatga kiradi.', 'Buxoriy, Muslim', [sn('bukhari', 574), sn('muslim', 635)], ['fajr', 'asr']),
  Q('q-2-238', 'Namozlarni, ayniqsa o‘rta namozni muhofaza qilinglar.', 'Baqara surasi, 238-oyat', [2, 238, 238], ['asr']),
];

// Vaqt tugashidan oldin — ogohlantirish, larza
export const WARN = [
  H('h-first', 'Qiyomat kuni bandadan birinchi so‘raladigan amal — namozdir.', 'Termiziy, Nasoiy', [sn('tirmidhi', 413), sn('nasai', 465)]),
  Q('q-4-103', 'Albatta, namoz mo‘minlarga vaqtlari belgilangan holda farz qilingan.', 'Niso surasi, 103-oyat', [4, 103, 103]),
  Q('q-107-4', 'Holiga voy namozxonlarki, ular namozlaridan g‘ofil bo‘lurlar.', 'Mo‘un surasi, 4–5-oyatlar', [107, 4, 5]),
  Q('q-74-42', '“Sizni do‘zaxga nima kiritdi?” — “Biz namoz o‘quvchilardan bo‘lmagan edik”, deydilar.', 'Muddassir surasi, 42–43-oyatlar', [74, 42, 43]),
  Q('q-19-59', 'Ulardan keyin namozni zoe qilgan va shahvatlarga ergashgan avlodlar keldi…', 'Maryam surasi, 59-oyat', [19, 59, 59]),
  H('h-tark', 'Kishi bilan shirk va kufr orasidagi chegara — namozni tark qilishdir.', 'Muslim', [sn('muslim', 82)]),
  H('h-ontime2', 'Amallarning Allohga eng suyuklisi — o‘z vaqtida o‘qilgan namozdir. Vaqt ketmoqda.', 'Buxoriy, Muslim', [sn('bukhari', 527), sn('muslim', 85)]),
  Q('q-2-238b', 'Namozlarni muhofaza qilinglar va Alloh uchun itoatkor holda turinglar.', 'Baqara surasi, 238-oyat', [2, 238, 238]),
];

// Kunlik qazo eslatmasi — tavba, umid
export const QAZO = [
  H('h-forgot', 'Kim namozni unutsa yoki uxlab qolsa, eslagan zahoti o‘qisin — uning kafforati shudir.', 'Buxoriy, Muslim', [sn('bukhari', 597), sn('muslim', 684)]),
  Q('q-11-114', 'Kunduzning ikki chekkasida va kechaning bir qismida namozni barpo qil. Albatta, yaxshiliklar yomonliklarni ketkazadi.', 'Hud surasi, 114-oyat', [11, 114, 114]),
  H('h-first2', 'Qiyomat kuni bandadan birinchi so‘raladigan amal — namozdir. Bugun bir qadam qo‘ying.', 'Termiziy, Nasoiy', [sn('tirmidhi', 413), sn('nasai', 465)]),
  Q('q-2-152b', 'Meni yod etinglar — Men ham sizni yod etaman.', 'Baqara surasi, 152-oyat', [2, 152, 152]),
  Q('q-20-132', 'Ahlingni namozga buyur va o‘zing unga sabrli bo‘l.', 'Toho surasi, 132-oyat', [20, 132, 132]),
  Q('q-2-45b', 'Sabr va namoz bilan Allohdan yordam so‘ranglar.', 'Baqara surasi, 45-oyat', [2, 45, 45]),
];

const ALL = [...START, ...WARN, ...QAZO];
export const quoteById = (id) => ALL.find((q) => q.id === id) || null;

// Sana va namozga qarab tanlanadi (har kuni boshqa gap). `only` bo'lsa — faqat o'sha namozlar uchun.
export function pick(list, seed, prayer) {
  const pool = list.filter((q) => !q.only || (prayer && q.only.includes(prayer)));
  return pool[Math.abs(Math.floor(seed)) % pool.length];
}
export const fmtQuote = (q) => `«${q.text}» (${q.ref})`;

// Oyatning arabcha asl matni — Quran.com ochiq API'sidan (Usmoniy rasm), telefonda keshlanadi
export async function fetchArabic([sura, from, to]) {
  const key = `ayah:${sura}:${from}-${to}`;
  try { const c = localStorage.getItem(key); if (c) return JSON.parse(c); } catch {}
  const out = [];
  for (let a = from; a <= to; a++) {
    const r = await fetch(`https://api.quran.com/api/v4/verses/by_key/${sura}:${a}?fields=text_uthmani`);
    if (!r.ok) throw new Error(r.status);
    const t = (await r.json())?.verse?.text_uthmani;
    if (!t) throw new Error('empty');
    out.push({ n: a, t });
  }
  try { localStorage.setItem(key, JSON.stringify(out)); } catch {}
  return out;
}
export const quranUrl = ([sura, from, to]) => `https://quran.com/${sura}/${from}${to > from ? `-${to}` : ''}`;
