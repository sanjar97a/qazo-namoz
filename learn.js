// "Bilim" bo'limi: namoz va qazo namozi bo'yicha qisqa qo'llanma.
// Mazmun O'zbekiston musulmonlari idorasi (fatvo.uz, muslim.uz) va islom.uz materiallari asosida
// qisqa bayon qilingan; har bo'lim oxirida manba havolasi bor. Zikrlar — an'anaviy matnlarning lotincha o'qilishi.

const SRC = {
  qazoFatvo: ['fatvo.uz — “Qazo namozi qanday o‘qiladi”, 08.09.2025', 'https://fatvo.uz/uz/answers/qazo-namozi-qanday-oqiladi-2467'],
  tartibFatvo: ['fatvo.uz — “Qazo bo‘lgan namoz birinchi o‘qiladimi…”, 04.04.2025', 'https://fatvo.uz/uz/answers/qazo-bolgan-namoz-birinchi-oqiladimi-yoki-vaqti-kirgan-namozmi-405'],
  fatvolar: ['muslim.uz — “Namozga oid fatvolar” (O‘zbekiston musulmonlari idorasi)', 'https://www.muslim.uz/uz/e/post/37888-namozga-oid-fatvolar'],
  qazo7: ['muslim.uz — “7 savolga 7 javob: qazo namozi”, 07.03.2018', 'https://muslim.uz/uz/e/post/34565-7-savolga-7-javob-qazo-namozi'],
  zamsura: ['muslim.uz — “Qazo namozlari va zamsura haqida”, 09.03.2017', 'https://www.muslim.uz/uz/e/post/38374-qazo-namozlari-va-zamsura-haqida?page=2&per-page=1'],
  tartib: ['islom.uz — “Namoz o‘qish tartibi”, 20.10.2016', 'https://islom.uz/maqola/36'],
  besh: ['muslim.uz — “Namoz saboqlari: peshin, asr, shom, xufton va qunut duosi”, 28.11.2019', 'https://muslim.uz/uz/e/post/23521-namoz-saboqlari-peshin-asr-shom-xufton-namozi-hamda-qunut-duosi-audio'],
  vaqtlar: ['muslim.uz — “Namoz o‘qish mumkin va mumkin bo‘lmagan vaqtlar”, 17.09.2020', 'https://www.muslim.uz/uz/e/post/16999-namoz-o-qish-mumkin-va-mumkin-bo-lmagan-vaqtlar'],
  audio: ['muslim.uz — “Namoz saboqlari” (audio darslar)', 'https://muslim.uz/uz/e/post/23602-namoz-saboqlari-namoz-o-qish-tartibi-audio'],
};
const src = (...keys) => `<div class="lsrc">Manba: ${keys.map((k) =>
  `<a href="${SRC[k][1]}" target="_blank" rel="noopener">${SRC[k][0]}</a>`).join('; ')}</div>`;
const zikr = (title, text, note = '') => `<div class="zikr"><b>${title}</b><div class="zt">${text}</div>${note ? `<div class="zn">${note}</div>` : ''}</div>`;

export const LEARN_SECTIONS = [
  {
    id: 'rakat', icon: '🕌', title: 'Besh vaqt namoz: rakatlar soni',
    html: `
      <table class="ltable">
        <tr><th>Namoz</th><th>Sunnat (oldin)</th><th>Farz</th><th>Sunnat (keyin)</th></tr>
        <tr><td>🌅 Bomdod</td><td>2</td><td><b>2</b></td><td>—</td></tr>
        <tr><td>☀️ Peshin</td><td>4</td><td><b>4</b></td><td>2</td></tr>
        <tr><td>🌤 Asr</td><td>—</td><td><b>4</b></td><td>—</td></tr>
        <tr><td>🌇 Shom</td><td>—</td><td><b>3</b></td><td>2</td></tr>
        <tr><td>🌙 Xufton</td><td>—</td><td><b>4</b></td><td>2</td></tr>
        <tr><td>✨ Vitr</td><td colspan="3"><b>3 rakat — vojib</b>, xuftondan keyin o‘qiladi</td></tr>
      </table>
      <p>Farz namozlarining jami: kuniga <b>17 rakat</b>, vitr bilan <b>20 rakat</b>.</p>
      ${src('besh', 'tartib')}`,
  },
  {
    id: 'tartib', icon: '📖', title: 'Namoz o‘qish tartibi (2 rakat)',
    html: `
      <p><b>Shartlar:</b> badan, kiyim va joy pok bo‘ladi, tahorat bilan, qiblaga yuzlanib turiladi.</p>
      <ol class="lsteps">
        <li><b>Niyat.</b> Qaysi namozni o‘qiyotganingizni dildan belgilaysiz, masalan: “Bomdod namozining ikki rakat farzini Alloh uchun o‘qishni niyat qildim”.</li>
        <li><b>Takbiri tahrima.</b> Ikki qo‘l kafti qiblaga qaragan holda ko‘tariladi, bosh barmoqlar quloq yumshog‘iga tegadi va “Allohu akbar” deyiladi. Qo‘llar kindik ostida bog‘lanadi.</li>
        <li><b>Sano, ta’avvuz, basmala</b> o‘qiladi (matnlari pastda).</li>
        <li><b>Fotiha</b> surasi, so‘ng Qur’ondan biror sura yoki oyatlar (zam sura) o‘qiladi.</li>
        <li><b>Ruku’.</b> “Allohu akbar” deb egilib, uch marta “Subhana Robbiyal ‘azim” deyiladi.</li>
        <li><b>Qavma.</b> Ko‘tarilayotganda “Sami’allohu liman hamidah”, tik turgach “Robbana lakal hamd” deyiladi.</li>
        <li><b>Sajda.</b> “Allohu akbar” deb tizza, kaftlar, burun va peshona yerga qo‘yiladi; uch marta “Subhana Robbiyal a’la” deyiladi.</li>
        <li><b>Ikki sajda orasi.</b> “Allohu akbar” bilan o‘tiriladi, so‘ng ikkinchi sajda qilinadi.</li>
        <li><b>Ikkinchi rakat.</b> Suyanmasdan turiladi; basmala, Fotiha va zam sura o‘qiladi, ruku’ va ikki sajda xuddi birinchi rakatdagidek bajariladi.</li>
        <li><b>Qa’da (o‘tirish).</b> Tashahhud (“Attahiyyot”), so‘ng salovotlar va duo o‘qiladi.</li>
        <li><b>Salom.</b> Avval o‘ngga, so‘ng chapga “Assalamu ‘alaykum va rohmatulloh” deyiladi.</li>
      </ol>
      <p class="lnote"><b>3 va 4 rakatli namozlarda:</b> ikkinchi rakatdan keyin faqat tashahhud o‘qilib, uchinchi rakatga turiladi.
        <b>Farz</b>ning 3- va 4-rakatlarida faqat Fotiha o‘qiladi; <b>sunnat</b>ning barcha rakatlarida Fotihadan keyin sura qo‘shiladi.
        Oxirgi rakatdan keyin tashahhud, salovot, duo va salom.</p>
      ${src('tartib', 'besh')}`,
  },
  {
    id: 'zikr', icon: '🤲', title: 'Namozda o‘qiladigan zikrlar',
    html: `
      <p class="lnote">Quyida an’anaviy arabcha matnlarning lotincha o‘qilishi berilgan. To‘g‘ri talaffuzni imom-xatibdan yoki
        <a href="${SRC.audio[1]}" target="_blank" rel="noopener">muslim.uz audio darslaridan</a> o‘rganing.</p>
      ${zikr('Sano', 'Subhanakallohumma va bihamdika va tabarokasmuka va ta’ala jadduka va la ilaha g‘oyruk.')}
      ${zikr('Ta’avvuz', 'A’uzu billahi minash-shaytonir rojim.')}
      ${zikr('Basmala', 'Bismillahir Rohmanir Rohim.')}
      ${zikr('Fotiha surasi', 'Alhamdu lillahi Robbil ‘alamin. Ar-Rohmanir-Rohim. Maliki yavmid-din. Iyyaka na’budu va iyyaka nasta’in. Ihdinas-sirotol mustaqim. Sirotollazina an’amta ‘alayhim, g‘oyril mag‘dubi ‘alayhim valad-dollin. (Omin)')}
      ${zikr('Ixlos surasi (zam sura uchun)', 'Qul huvallohu ahad. Allohus-somad. Lam yalid va lam yulad. Va lam yakul-lahu kufuvan ahad.')}
      ${zikr('Ruku’ tasbehi (3 marta)', 'Subhana Robbiyal ‘azim.')}
      ${zikr('Ruku’dan turishda', 'Sami’allohu liman hamidah. — Robbana lakal hamd.')}
      ${zikr('Sajda tasbehi (3 marta)', 'Subhana Robbiyal a’la.')}
      ${zikr('Tashahhud (Attahiyyot)', 'Attahiyyatu lillahi vas-solavatu vat-toyyibat. Assalamu ‘alayka ayyuhan-nabiyyu va rohmatullohi va barokatuh. Assalamu ‘alayna va ‘ala ‘ibadillahis-solihin. Ash-hadu alla ilaha illalloh, va ash-hadu anna Muhammadan ‘abduhu va rosuluh.')}
      ${zikr('Salovot', 'Allohumma solli ‘ala Muhammadin va ‘ala ali Muhammad, kama sollayta ‘ala Ibrohima va ‘ala ali Ibrohim, innaka Hamidum Majid. Allohumma barik ‘ala Muhammadin va ‘ala ali Muhammad, kama barokta ‘ala Ibrohima va ‘ala ali Ibrohim, innaka Hamidum Majid.')}
      ${zikr('Duo', 'Robbana atina fid-dunya hasanatan va fil-axiroti hasanatan va qina ‘azaban-nar.')}
      ${zikr('Salom', 'Assalamu ‘alaykum va rohmatulloh.')}
      ${src('tartib', 'audio')}`,
  },
  {
    id: 'vitr', icon: '✨', title: 'Vitr namozi va qunut',
    html: `
      <p>Vitr — <b>3 rakat, vojib</b>, xufton namozidan keyin o‘qiladi.</p>
      <ol class="lsteps">
        <li>Birinchi ikki rakat odatdagidek (Fotiha va sura bilan) o‘qiladi, ikkinchi rakatdan keyin faqat tashahhud o‘qib turiladi.</li>
        <li>Uchinchi rakatda Fotiha va sura o‘qilgach, “Allohu akbar” deb qo‘llar quloq barobar ko‘tariladi va yana kindik ostida bog‘lanadi.</li>
        <li><b>Qunut duosi</b> o‘qiladi, so‘ng ruku’, ikki sajda, tashahhud, salovot, duo va salom.</li>
      </ol>
      ${zikr('Qunut duosi', 'Allohumma inna nasta’inuka va nastag‘firuka va nu’minu bika va natavakkalu ‘alayka va nusni ‘alaykal xoyro kullahu, nashkuruka va la nakfuruka va naxla’u va natruku man yafjuruk. Allohumma iyyaka na’budu va laka nusolli va nasjudu va ilayka nas’a va nahfidu, narju rohmataka va naxsha ‘azabaka, inna ‘azabaka bil-kuffari mulhiq.',
        'Qunutni hali yod olmagan kishi “Robbana atina…” duosini bir marta yoki “Allohummag‘fir lana” ni uch marta o‘qiydi (muslim.uz, 138-fatvo).')}
      ${src('besh', 'fatvolar')}`,
  },
  {
    id: 'qazo', icon: '⏳', title: 'Qazo namozini o‘qish tartibi',
    html: `
      <ol class="lsteps">
        <li><b>Nimalar qazo qilinadi:</b> besh vaqt namozning <b>farzlari</b> va <b>vitr</b>. Sunnatlar qazo qilinmaydi (bomdod qazosini o‘sha kuni zavoldan oldin o‘qisa, sunnati bilan birga o‘qiydi).</li>
        <li><b>Bir kunlik qazo:</b> bomdod 2 + peshin 4 + asr 4 + shom 3 + xufton 4 + vitr 3 = <b>20 rakat</b>.</li>
        <li><b>O‘qilishi:</b> o‘z vaqtidagi namoz kabi — 4 rakatli farzning 3- va 4-rakatlarida faqat Fotiha o‘qiladi. Vitr qazosida qunut ham o‘qiladi.</li>
        <li><b>Qachon:</b> esga tushishi bilan, kechiktirmasdan. Kunning istalgan vaqtida o‘qish mumkin — faqat quyosh <b>chiqayotgan</b>, <b>tikkaga kelgan (zavol)</b> va <b>botayotgan</b> paytlar bundan mustasno.</li>
        <li><b>Azon va iqomat:</b> qazo ham azon-iqomat bilan o‘qiladi; bir nechtasi ketma-ket o‘qilsa, birinchisiga azon, qolganlariga faqat iqomat aytiladi.</li>
        <li><b>Joy:</b> qazoni masjidda emas, uyda o‘qishga harakat qilinadi. Qazo nafl namozlardan ustun turadi (sunnatlar, choshgoh va ayrim nafllar bundan mustasno).</li>
        <li><b>Safar:</b> safarda qolgan 4 rakatli namoz uyda ham 2 rakat (qasr) qazo qilinadi; uyda qolgani safarda ham to‘liq 4 rakat o‘qiladi.</li>
      </ol>
      ${src('qazoFatvo', 'fatvolar', 'qazo7', 'zamsura')}`,
  },
  {
    id: 'niyat', icon: '💭', title: 'Qazo namozining niyati',
    html: `
      <p>Niyatda <b>qaysi namoz ekani aniq tayin qilinadi</b>. Fatvo markazi bergan namuna:</p>
      ${zikr('Niyat namunasi (bomdod)', '“Niyat qildim qazo bo‘lgan bomdod namozining farzini o‘qishni.”', 'Boshqa namozlarda nomi almashtiriladi: peshin, asr, shom, xufton farzi; vitr uchun — “qazo bo‘lgan vitr namozini”.')}
      <ul class="lsteps">
        <li>Asr qazosini “peshin qazosi” deb niyat qilish yoki “zimmamdagi to‘rt rakat qazoni o‘qiyman” deb noaniq niyat qilish <b>durust emas</b>.</li>
        <li>Farzda rakatlar sonini niyatda aytish shart emas, lekin aytilsa yaxshi.</li>
      </ul>
      <p class="lnote">Ko‘p yillik qazolarda har bir namozning qaysi kunga tegishli ekanini qanday belgilash bo‘yicha savolingiz bo‘lsa,
        mahalla imom-xatibidan yoki <a href="https://fatvo.uz" target="_blank" rel="noopener">fatvo.uz</a> orqali Fatvo markazidan so‘rang.</p>
      ${src('qazoFatvo', 'fatvolar')}`,
  },
  {
    id: 'sohibitartib', icon: '🔢', title: 'Tartib: qaysi biri oldin o‘qiladi?',
    html: `
      <p><b>Qazosi 6 tadan kam bo‘lsa (ahli tartib):</b> qazolar vaqtidagi namozdan <b>oldin</b> va o‘zaro tartib bilan (eng oldin qolganidan boshlab) o‘qilishi vojib.
        Masalan, bomdod qazosini o‘qimay peshinni o‘qisa, peshin durust bo‘lmaydi. Vitr ham shu tartibga kiradi.</p>
      <p><b>Qazosi 6 va undan ko‘p bo‘lsa:</b> tartib shart emas — xohlasa avval vaqtidagi namozni, xohlasa qazoni o‘qiydi.
        Qazolar orasida ham tartib majburiy emas: masalan, avval 30 ta bomdod, keyin 30 ta peshin qazosini o‘qish mumkin.
        Bomdod, peshin, asr ketma-ketligida o‘qish esa mustahab (yaxshi).</p>
      <p class="lnote">Bu ilova ko‘p yillik qazolarni hisoblaydi — shuning uchun ko‘pchilik foydalanuvchilar ikkinchi holatga kiradi.</p>
      ${src('tartibFatvo', 'fatvolar', 'qazo7', 'zamsura')}`,
  },
  {
    id: 'vaqtlar', icon: '🚫', title: 'Namoz o‘qib bo‘lmaydigan vaqtlar',
    html: `
      <ul class="lsteps">
        <li>Quyosh <b>chiqayotgan</b> payt.</li>
        <li>Quyosh <b>tikkaga kelgan</b> (zavol) payt.</li>
        <li>Quyosh <b>botayotgan</b> payt — faqat o‘sha kungi asrni ado etish mumkin.</li>
        <li>Bomdoddan keyin quyosh chiqquncha va asrdan keyin quyosh botguncha <b>nafl</b> o‘qilmaydi (qazo emas, nafl).</li>
      </ul>
      ${src('vaqtlar', 'qazoFatvo')}`,
  },
];

export const LEARN_DISCLAIMER = `Bu bo‘lim O‘zbekiston musulmonlari idorasi (fatvo.uz, muslim.uz) va islom.uz materiallari asosida
  qisqa bayon qilingan (Hanafiy mazhabi). Har bir qism ostida manba ko‘rsatilgan. Ibodatni to‘liq o‘rganish uchun
  imom-xatibga murojaat qiling (ayollar namozidagi ayrim holatlar ham farq qiladi); savollar bo‘yicha rasmiy javobni <a href="https://fatvo.uz" target="_blank" rel="noopener">fatvo.uz</a> beradi.`;
