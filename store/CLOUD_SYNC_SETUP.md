# Cloud Sync (V2) — Firebase sozlash

Maqsad: foydalanuvchi **Google bilan kiradi** → qazo hisobi, tarix va sozlamalar bulutga saqlanadi → yangi telefonda kirsa, hammasi tiklanadi.
Texnologiya: **Firebase Authentication (Google)** + **Cloud Firestore**. Bepul tarif (Spark) ming-minglab foydalanuvchiga yetadi.

Bu qismlarni faqat siz qila olasiz (Google akkauntingizda loyiha ochiladi). Har bir qadamdan keyin menga yozing.

## 1. Firebase loyihasi
1. https://console.firebase.google.com → **Add project** → nomi: `namoz-qazo` → Google Analytics: **o‘chirib qo‘ying** (kerak emas) → Create.

## 2. Android ilovani qo‘shish
1. Project Overview → **Android** belgisi.
2. **Package name:** `uz.sanjar97a.namozqazo`
3. **App nickname:** Namoz va Qazo
4. **SHA-1** — quyidagi ikkalasini qo‘shing (Project settings → Your apps → Add fingerprint):
   - Sinov APK kaliti: `C1:27:89:00:1B:C0:61:77:02:5B:B2:09:F5:9B:05:D1:0D:AA:CF:01`
   - Play yuklash kaliti: `FB:CE:55:6A:4A:4E:3D:9C:8B:97:E7:7C:B9:13:E1:F5:6F:32:64:DC`
   - Play Console’da ilova yaratilgach: **App integrity → App signing key certificate → SHA-1** ni ham qo‘shasiz (Google’ning imzo kaliti).
5. **google-services.json** faylini yuklab oling va menga yuboring (u maxfiy emas, lekin ommaga tarqatmang).

## 3. Veb-ilovani qo‘shish (sayt uchun)
1. Project Overview → **</>** (Web) → nickname: `namoz-qazo-web` → Register.
2. Ko‘rsatilgan `firebaseConfig` obyektini (apiKey, authDomain, projectId, appId…) nusxalab menga yuboring.
3. Authentication → Settings → **Authorized domains** → `sanjar97a.github.io` ni qo‘shing.

## 4. Google bilan kirishni yoqish
Authentication → **Get started** → Sign-in method → **Google** → Enable → support email: o‘zingizniki → Save.

## 5. Firestore
1. Firestore Database → **Create database** → joylashuv: `eur3 (Europe)` yoki yaqin region → **Production mode**.
2. **Rules** bo‘limiga quyidagini qo‘yib, **Publish** bosing (har kim faqat o‘z ma’lumotini o‘qiy/yoza oladi):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid
                         && (request.resource == null || request.resource.size() < 900000);
    }
    match /{document=**} { allow read, write: if false; }
  }
}
```

## Men qiladigan qism (siz yuqoridagilarni bergach)
- Native Google kirish plagini (`@capacitor-firebase/authentication`) va Firestore ulanishi.
- Sozlamalar → “☁️ Bulutga saqlash”: Google bilan kirish/chiqish, oxirgi sinxronlash vaqti.
- Avtomatik sinxronlash: har o‘zgarishdan keyin (internet bo‘lsa) va ilova ochilganda; ikki telefonda ziddiyat bo‘lsa — eng so‘nggi o‘zgarish saqlanadi, qazo tarixi kunlar bo‘yicha birlashtiriladi.
- Maxfiylik siyosati va Play “Data safety” javoblarini yangilash (email va qazo ma’lumoti endi serverda saqlanadi).
- Hisobni o‘chirish tugmasi (Play talabi: foydalanuvchi bulutdagi ma’lumotini o‘chira olishi kerak).
