# Tabulo – Uygulama Oluşturma Prompt'u

> **Nasıl kullanılır?**
> 1. Boş bir proje klasörü aç. İçine `docs/` klasörü oluştur.
> 2. Bu dosyayı `docs/PROMPT.md`, şema dosyasını `docs/schema.ts` olarak koy.
> 3. Claude Code'a şunu yaz: **"docs/PROMPT.md dosyasını baştan sona oku ve Faz 0'dan başla."**
> 4. Claude her fazın sonunda durup senin onayını bekleyecek. Test et, sonra "devam" de.

---

## 1. Rolün ve görevin

Sen deneyimli bir React Native / Expo geliştiricisisin. **Tabulo** adlı bir mobil uygulamayı sıfırdan, üretime hazır kalitede geliştireceksin.

**Tabulo nedir?** Küçük esnaf, serbest çalışan ve küçük işletmeler için sade bir **cari hesap ve gelir-gider takip** uygulaması. Kullanıcı carilerini (müşteri/tedarikçi) kaydeder; tahsilat, ödeme, veresiye ve devir hareketlerini girer; kasa ve banka bakiyelerini, kimin ne kadar borçlu olduğunu görür; düzenli ödemeleri için hatırlatma alır; raporları grafiklerle inceler; Excel ve PDF olarak dışa aktarır; müşteriye WhatsApp üzerinden PDF ekstre gönderir.

**Hedef pazarlar:** Türkiye, İngiltere, ABD. İlk dil Türkçe, ikinci dil İngilizce. Arayüzde hiçbir metin koda gömülmez, hepsi çeviri dosyasından gelir.

**Temel ilkeler:**
- **Sunucu yok.** Tüm veriler cihazda (SQLite). Hesap açma / giriş yok. Uygulama internetsiz tam çalışır (abonelik doğrulaması hariç).
- **Gizlilik:** Kişisel veri toplayan analitik veya reklam SDK'sı eklenmez.
- **Sadelik:** Hedef kullanıcı teknolojiyle arası iyi olmayan bir esnaf olabilir. Büyük yazı, büyük butonlar, az adım.
- **Kalite:** TypeScript `strict`, temiz klasör yapısı, tekrar kullanılabilir bileşenler, kritik hesaplamalar için birim testleri.

---

## 2. Çalışma kuralların

1. İşi aşağıdaki **fazlara** göre yap. Her fazın sonunda **dur**, ne yaptığını kısaca özetle, nasıl test edileceğini söyle ve onay bekle.
2. Bir paketi kurmadan önce **resmi dokümantasyonunu kontrol et**; bu prompt'taki kurulum notları ile güncel doküman çelişirse dokümanı uygula ve bana söyle.
3. Paketleri `npx expo install` ile kur (Expo uyumlu sürümü seçsin).
4. Emin olmadığın bir iş kuralı olursa tahmin etme, **sor**.
5. `docs/schema.ts` veri yapısının **tek doğruluk kaynağıdır**. Onu `src/db/schema.ts` olarak taşı. Yapıda değişiklik gerekirse önce bana gerekçesiyle öner.
6. Her fazdan sonra `npx tsc --noEmit` ve testler hatasız geçmeli.
7. İş mantığını ekran koduna gömme: hesaplamalar `src/core/`, veri erişimi `src/db/repositories/` içinde olur (bkz. Bölüm 9).

---

## 3. Teknoloji yığını

| Alan | Teknoloji | Not |
|---|---|---|
| Çatı | **Expo (SDK: HeroUI Native'in desteklediği en güncel sürüm) + TypeScript** | Native modüller (MMKV, RevenueCat, Skia) yüzünden **Expo Go değil, development build** kullanılacak (`expo-dev-client`, EAS Build) |
| Navigasyon | **Expo Router** | Dosya tabanlı; alt sekmeler + modal/bottom sheet |
| UI bileşenleri | **HeroUI Native** | Button, Input, Select, BottomSheet, Dialog, Toast, Tabs, SearchField, Skeleton vb. |
| Stil | **Uniwind (Tailwind CSS v4)** + **tailwind-merge** | NativeWind KULLANILMAYACAK. Tema `global.css` içinde `@theme` ve `@variant` ile; `tailwind.config.js` yok; Metro config `withUniwindConfig` ile sarılır; üçüncü parti bileşenler `withUniwind` ile stillenir |
| Veritabanı | **expo-sqlite + Drizzle ORM + drizzle-kit** | Migration'lar `useMigrations` ile uygulama açılışında çalışır |
| Kimlik | **uuid (v7)** + **react-native-get-random-values** | |
| Küçük ayarlar | **react-native-mmkv** | Dil, tema, son seçilen hesap, onboarding tamamlandı mı |
| Durum yönetimi | **Zustand** | Sadece arayüz durumu; veri her zaman veritabanından |
| Formlar | **react-hook-form + zod** | Koşullu alanlar ve doğrulama |
| Tarih | **date-fns** (tr ve en-GB / en-US yerelleri) | |
| Uzun listeler | **@shopify/flash-list** | Cari ve işlem listeleri |
| Grafikler | **victory-native** (+ @shopify/react-native-skia, react-native-reanimated, react-native-gesture-handler) | |
| Simgeler | **lucide-react-native** + **react-native-svg** | |
| Yazı tipi | **Plus Jakarta Sans** (`@expo-google-fonts/plus-jakarta-sans`) | 400, 500, 600, 700, 800 |
| PDF | **expo-print** (HTML şablon → PDF) | Ekstre ve rapor |
| Excel | **xlsx (SheetJS)** + **expo-file-system** | |
| Paylaşım | **expo-sharing** | PDF/Excel/yedek dosyası paylaşımı (WhatsApp dahil) |
| Belge ekleme | **expo-image-picker** (kamera/galeri) + **expo-document-picker** (PDF) | Dosyalar uygulamanın belge klasörüne kopyalanır |
| Klavye | **react-native-keyboard-controller** | `KeyboardAwareScrollView`, `KeyboardToolbar` (önceki/sonraki/bitti), `KeyboardStickyView` |
| Güvenli alanlar | **react-native-safe-area-context** | Çentik, Dynamic Island, ev çubuğu, Android gezinme çubuğu |
| Sistem çubukları | **expo-status-bar**, **expo-system-ui**, **expo-navigation-bar** | Temaya göre durum çubuğu ve Android gezinme çubuğu |
| Tarih seçici | **@react-native-community/datetimepicker** | Platformun kendi tarih/saat seçicisi |
| Dokunsal geri bildirim | **expo-haptics** | Kaydet, sil, hata titreşimleri |
| Uygulama kilidi | **expo-local-authentication** | Face ID / Touch ID / parmak izi / cihaz şifresi |
| Bildirimler | **expo-notifications** (yalnızca yerel bildirim) | |
| Çoklu dil | **i18next + react-i18next + expo-localization** | `tr` ve `en` |
| Abonelik | **react-native-purchases (RevenueCat)** + **react-native-purchases-ui** | iOS ve Android tek yerden |
| Test | **jest-expo** + **@testing-library/react-native** | |
| Kod kalitesi | ESLint + Prettier | |

---

## 4. Tasarım sistemi

### 4.1 Marka
- **Ad:** Tabulo (yazı markasında küçük harf: `tabulo`)
- **Logo:** Lacivert yuvarlatılmış kare zemin, üstte kehribar renkli bir dosya sekmesi, ortada beyaz bir tablet ve tabletin içinde yuvarlak hatlı küçük **t** harfi.

Logonun SVG kodu (react-native-svg'ye çevrilecek, `src/components/brand/Logo.tsx` ve uygulama ikonu için kullanılacak):

```xml
<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
  <rect width="120" height="120" rx="28" fill="#1E3A5F"/>
  <rect x="64" y="22" width="22" height="16" rx="4" fill="#F2A93B"/>
  <rect x="28" y="30" width="64" height="66" rx="10" fill="#FFFFFF"/>
  <path d="M56 42 V76 Q56 87 67 87 H72" fill="none" stroke="#1E3A5F" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M45 55 H71" fill="none" stroke="#1E3A5F" stroke-width="10" stroke-linecap="round"/>
</svg>
```

Uygulama ikonu (iOS 1024×1024, Android adaptive icon) ve splash ekranı bu SVG'den üretilecek. Splash: lacivert zemin, ortada logo.

**Hazır marka dosyaları `docs/designs/` klasöründe** (bunları kullan, logoyu yeniden çizme; başka logo varyasyonu yoktur, bu tek ve son logodur):
- `logo.svg`, `logo-1024.png` – yuvarlatılmış köşeli logo (uygulama içi, onboarding, PDF başlığı)
- `icon-ios.svg`, `icon-ios-1024.png` – köşesiz kare iOS uygulama ikonu (iOS köşeleri kendisi yuvarlar)
- `adaptive-icon-foreground.svg`, `adaptive-icon-foreground-1024.png` – Android adaptive icon ön planı (şeffaf zemin); arka plan rengi `#1E3A5F`

### 4.1.1 Ekran tasarımları
`docs/designs/` klasöründe onaylanmış iki ekran tasarımı var. **Görsel dili (boşluklar, köşe yuvarlaklıkları, kart yapısı, tipografi, renk kullanımı, alt sekme ve + butonu) birebir bunlara göre kur; diğer tüm ekranları da aynı dille tasarla.**
- `home.png` + `home.html` – Ana sayfa
- `client-detail.png` + `client-detail.html` – Cari detay

PNG dosyaları görünümü, HTML dosyaları kesin ölçüleri (px, renk, font ağırlığı) gösterir. HTML'i React Native'e birebir kopyalama; HeroUI Native bileşenleri ve Uniwind sınıflarıyla yeniden kur. Tasarımdaki isimler ve tutarlar örnektir. Telefon numarası, durum çubuğu gibi sistem öğeleri tasarımda yoktur, gerçek uygulamada sistem tarafından gösterilir.

### 4.2 Renkler (Uniwind `@theme` değişkenleri olarak tanımla)

| Token | Açık tema | Koyu tema | Kullanım |
|---|---|---|---|
| `primary` | `#1E3A5F` | `#8FB4E3` | Marka, ana kartlar, metin bağlantıları |
| `primary-foreground` | `#FFFFFF` | `#0E1620` | Primary üzerindeki metin |
| `accent` | `#F2A93B` | `#F2A93B` | Ana eylem butonları (+ İşlem ekle), vurgu, vade/uyarı etiketleri |
| `accent-foreground` | `#16202B` | `#16202B` | Accent üzerindeki metin (beyaz değil!) |
| `background` | `#F6F7F9` | `#0E1620` | Ekran zemini |
| `surface` | `#FFFFFF` | `#16202B` | Kartlar, listeler |
| `foreground` | `#16202B` | `#F2F4F7` | Ana metin |
| `muted` | `#5B6472` | `#AEB7C3` | İkincil metin |
| `border` | `#E3E6EB` | `#273242` | Kenarlıklar, ayraçlar |
| `positive` | `#15803D` | `#4ADE80` | Alacak, tahsilat (para girişi) |
| `negative` | `#B91C1C` | `#F87171` | Borç, ödeme (para çıkışı) |
| `warning-bg` | `#FDF3E1` | `#3A2A10` | Vade yaklaşan etiket zemini |
| `warning-fg` | `#8A5300` | `#F5C77A` | Vade yaklaşan etiket metni |

### 4.3 Kurallar
- **Tutarlar renk + işaretle gösterilir:** alacak/giriş `+ ₺1.500` (positive), borç/çıkış `− ₺640` (negative). Renk körü kullanıcılar için işaret zorunlu.
- Tüm dokunulabilir alanlar **en az 44×44 px**.
- Köşe yuvarlaklığı: kart 18–22 px, buton 12–16 px, input 12 px.
- Boşluk ölçeği 4'ün katları (4, 8, 12, 16, 20, 24).
- Tipografi: tutarlar 800 kalınlık; büyük bakiye 32–36 px, liste tutarı 15 px; gövde metni 15 px; ikincil metin 12–13 px.
- Açık, koyu ve sistem teması desteklenir (Ayarlar'dan seçilir).
- Telefonun yazı boyutu ayarı (Dynamic Type) büyütüldüğünde arayüz bozulmamalı.
- Boş durumlarda (hiç cari yok, hiç işlem yok) açıklayıcı metin + tek bir eylem butonu.

### 4.4 Koyu tema kuralları
- Renkler **yalnızca token üzerinden** kullanılır; bileşenlerde sabit hex renk yazmak yasak (logo SVG'si hariç).
- Ayarlar'dan Açık / Koyu / Sistem seçilir, MMKV'de saklanır. "Sistem" seçiliyken telefonun teması değişince uygulama anında güncellenir.
- Açılışta beyaz flaş olmamalı: `userInterfaceStyle: "automatic"`, splash'in koyu tema varyantı tanımlı.
- Durum çubuğu: açık temada koyu simgeler, koyu temada açık simgeler. Android gezinme çubuğu zemin rengiyle uyumlu.
- Koyu temada saf siyah kullanılmaz (`#0E1620`); kartlar bir ton açık (`#16202B`). Koyu temada gölge yerine kenarlık ve ton farkı kullanılır.
- iOS'ta klavye görünümü temaya uyar (`keyboardAppearance` dark/light).
- Grafik renkleri her iki tema için ayrı tanımlanır; çubuklar zemine karşı en az 3:1 kontrastlı, eksen ve ızgara çizgileri `muted`.
- Tarih seçici, BottomSheet, Dialog, Toast, Select menüleri ve paywall koyu temada ayrıca kontrol edilir.
- Metin kontrastı en az 4.5:1. Her ekran hem açık hem koyu temada kontrol edilir.
- **PDF ve Excel çıktıları her zaman açık temadır** (baskıya uygun).

---

## 5. Veri yapısı

`src/db/schema.ts` (= `docs/schema.ts`) dosyasını aynen kullan. Özet:

| Tablo | İçerik |
|---|---|
| `business_profile` | İşletme adı/unvanı, telefon, e-posta, il, ilçe, adres, vergi no, vergi dairesi, logo, para birimi (tek satır) |
| `contacts` (Cariler) | Kişi türü (Şahıs/Şirket), cari tipi (Müşteri/Tedarikçi/İkisi), Ad (şahısta Ad Soyad, şirkette Unvan), TC Kimlik No (şahıs), Vergi No + Vergi Dairesi (şirket), il, ilçe, adres, telefon, e-posta, not, durum (Aktif/Pasif) |
| `accounts` (Hesaplar) | Ad, tip (Kasa/Banka), banka adı, IBAN, açılış bakiyesi, durum |
| `transaction_types` (İşlem türleri) | Ad, yön (Gelir/Gider), hazır mı, durum, sıra |
| `subjects` (İşlem konuları) | Ad (Genel, Araç, Ofis, Diğer…), durum, sıra |
| `transactions` (Hareketler) | Hareket tipi, hesap, işlem türü, konu, cari, tarih, tutar, açıklama, belge no, vade tarihi, devir yönü, düzenli ödeme bağlantısı |
| `attachments` (Belgeler) | Bir harekete bağlı fotoğraf/PDF dosyaları |
| `recurring_payments` (Düzenli ödemeler) | Başlık, hareket tipi, tutar, hesap, tür, konu, cari, sıklık, aralık, başlangıç/bitiş, sonraki tarih, kaç gün önce ve saat kaçta hatırlatılacağı, durum |
| `reminders` (Tahsilat hatırlatıcıları) | Cari, ilgili hareket, tarih, saat, not, durum |

### 5.1 Hareket tipleri ve etkileri

| Hareket tipi | Ekranda (TR) | Ekranda (EN) | Kasa/Banka | Cari bakiyesi | Hesap | Cari |
|---|---|---|---|---|---|---|
| `collection` | Tahsilat | Money in | **+** | − (carinin borcu azalır) | Zorunlu | İsteğe bağlı |
| `payment` | Ödeme | Money out | **−** | + (bizim borcumuz azalır) | Zorunlu | İsteğe bağlı |
| `credit_sale` | Veresiye Satış | Sale on credit | — | **+** (cari bize borçlanır) | Boş | Zorunlu |
| `credit_purchase` | Veresiye Alış | Purchase on credit | — | **−** (biz borçlanırız) | Boş | Zorunlu |
| `opening` | Devir | Opening balance | — | Devir yönüne göre ± | Boş | Zorunlu |

- **Cari bakiyesi:** pozitif = cari bize borçlu ("Size borçlu"), negatif = biz cariye borçluyuz ("Borcunuz").
- Bakiyeler **saklanmaz**, her seferinde SQL ile hesaplanır (örnek sorgular şema dosyasının sonunda).
- `MOVEMENT_EFFECT` sabiti tek doğruluk kaynağıdır; hesaplamalar ona dayanır ve **birim testleriyle** doğrulanır.
- İşlem türü seçimi hareket tipine göre filtrelenir: Tahsilat → gelir türleri, Ödeme → gider türleri. Veresiye satış → gelir türleri, veresiye alış → gider türleri. Devirde işlem türü gizlenir.
- Silme her zaman yumuşak silmedir (`deleted_at`); silindikten sonra 5 saniye "Geri al" toast'ı gösterilir.

### 5.2 Hazır veriler (ilk açılışta, migration sonrası tek sefer)
- **Hesap:** "Kasa" (tip: kasa)
- **Gelir türleri:** Satış, Hizmet Bedeli, Cari Tahsilatı, Kira Geliri, Faiz Geliri, Diğer Gelir
- **Gider türleri:** Doğalgaz, Elektrik, Kargo, Kira, Ofis Gideri, Personel, SGK, Su, Vergi, Yakıt, Yemek, Diğer
- **Konular:** Genel, Araç, Ofis, Diğer
- Hazır kayıtların adları seçilen dile göre eklenir (İngilizce için karşılıkları çeviri dosyasından). Kullanıcı hazır kayıtları yeniden adlandırabilir ve pasife alabilir, ama silemez.

---

## 6. İş kuralları

### 6.1 Tutar
- Kullanıcı `25450,65`, `25.450,65`, `25450.65` veya `25,450.65` yazabilir. Dile göre doğru ayrıştır.
- Ondalıktan sonra **en fazla 2 basamak**. Fazlası girilemez.
- Veritabanına **kuruş cinsinden tam sayı** yazılır: 25.450,65 → `2545065`.
- Gösterimde `Intl.NumberFormat` kullan: TR `25.450,65 ₺`, UK `£25,450.65`, US `$25,450.65`.
- Tutar girişi için özel bir `AmountInput` bileşeni yaz: sayısal klavye, büyük punto, para birimi simgesi.
- `src/core/money.ts` içindeki ayrıştırma ve biçimlendirme fonksiyonları için kapsamlı birim testi yaz (binlik ayraç, virgül/nokta, boş değer, sıfır, negatif girişin reddi, 3 ondalık basamağın reddi).

### 6.2 Cari formu
- En üstte **Şahıs / Şirket** seçimi (segment kontrol).
- Şahıs seçiliyse: "Ad Soyad" etiketi + **TC Kimlik No** alanı görünür.
- Şirket seçiliyse: "Unvan" etiketi + **Vergi No** ve **Vergi Dairesi** alanları görünür.
- Ortak: cari tipi, il, ilçe, adres, telefon, e-posta, not, durum.
- Cari eklerken isteğe bağlı **"Açılış bakiyesi"** bölümü: tutar + yön (Alacağım var / Borcum var). Doldurulursa otomatik bir **Devir** hareketi oluşturulur.
- **TC Kimlik No doğrulaması** (boş bırakılabilir; doluysa):
  - 11 hane, sadece rakam, ilk hane 0 olamaz.
  - 10. hane = ((1.+3.+5.+7.+9. hanelerin toplamı) × 7 − (2.+4.+6.+8. hanelerin toplamı)) mod 10
  - 11. hane = (ilk 10 hanenin toplamı) mod 10
- **Vergi No:** boş bırakılabilir; doluysa 10 hane, sadece rakam.
- **Telefon:** ülke koduyla E.164 biçiminde saklanır (`+905320000000`); varsayılan ülke kodu işletme para birimine/diline göre.
- **İl / İlçe:** Türkiye için aranabilir seçim listesi. Veriyi `assets/data/tr-il-ilce.json` olarak güvenilir bir açık kaynak veri setinden oluştur ve **81 il** ile ilçe sayısını doğrula; uydurma veri kullanma. İngilizce/diğer ülkeler için serbest metin ("City" / "County / State").
- Ülkeye özel alanlar: dil İngilizce ise TC Kimlik No alanı "Tax ID" (isteğe bağlı) olarak, Vergi No "Company / VAT No" olarak etiketlenir; doğrulama yalnızca Türkiye ayarında uygulanır.
- **Pasif cari:** cari listesinde varsayılan olarak gizli ("Pasifleri göster" filtresi), yeni harekette seçilemez, geçmiş hareketleri ve bakiyesi durur.

### 6.3 KVKK / gizlilik
- TC Kimlik No ekranda maskeli gösterilir: `123******01` (dokununca açılır).
- Excel/PDF dışa aktarımda TC Kimlik No **varsayılan olarak yer almaz** (dışa aktarma ekranında "Kimlik numaralarını dahil et" seçeneği, varsayılan kapalı).
- Ayarlar'da kısa bir gizlilik açıklaması: "Verileriniz yalnızca bu cihazda saklanır."

### 6.4 Hareket formu
- Alanlar: **Hareket tipi**, **Hesap**, **İşlem türü**, **İşlem konusu**, **Tarih** (varsayılan bugün), **Cari**, **Tutar**, **Açıklama**, **Belge no**, **Vade tarihi**, **Devir yönü**, **Belgeler** (fotoğraf çek / galeriden seç / PDF seç; birden fazla).
- Alanlar hareket tipine göre görünür/gizlenir ve zorunlu olur (bkz. 5.1). Vade tarihi yalnızca veresiyede, devir yönü yalnızca devirde görünür.
- **Hızlı giriş öncelikli:** en üstte büyük tutar alanı, altında hareket tipi seçimi; diğer alanlar akıllı varsayılanlarla dolu (son kullanılan hesap, "Genel" konusu, bugünün tarihi). Kullanıcı yalnızca tutar ve cari girip kaydedebilmeli.
- Cari detay ekranından açılırsa cari önceden seçili gelir.
- Kaydet sonrası toast: "Kaydedildi" + "Yeni ekle" kısayolu.
- Belgeler `FileSystem.documentDirectory/attachments/` altına kopyalanır; fotoğraflar makul boyuta küçültülür (uzun kenar ~1600 px, JPEG kalite ~0.7).

### 6.5 Düzenli ödemeler
- Liste: başlık, tutar, sonraki tarih, kalan gün (7 gün ve altı `warning` etiketi, geçmişse `negative` "Gecikti" etiketi).
- **"Ödendi" butonu:** ilgili hareketi (tahsilat/ödeme) oluşturur, `next_due_date`'i sıklık × aralık kadar ileri alır, bildirimi yeniden kurar. Tutar ve tarih ödeme anında düzenlenebilir.
- **Bildirim:** `next_due_date − remind_days_before` gününde `remind_time` saatinde yerel bildirim. Uygulama her açıldığında aktif tüm düzenli ödemeler ve hatırlatıcıların bildirimleri kontrol edilip eksikse yeniden kurulur.
- Bildirim izni ilk düzenli ödeme eklenirken istenir (uygulama açılışında değil).

### 6.6 Tahsilat hatırlatıcıları
- Cari detayında "Hatırlat" butonu: tarih + saat + not seçilir, yerel bildirim kurulur.
- Bildirime dokunulunca ilgili cari detayı açılır.

### 6.7 WhatsApp
- **PDF ekstre gönder:** Cari ekstresi PDF olarak üretilir ve `expo-sharing` ile paylaşım ekranı açılır (kullanıcı WhatsApp'ı seçer).
- **Hatırlatma mesajı gönder:** Carinin telefonu varsa `https://wa.me/<telefon>?text=<mesaj>` bağlantısı açılır. Varsayılan mesaj (çeviri dosyasında, düzenlenebilir): "Merhaba {ad}, {tarih} itibarıyla güncel bakiyeniz {tutar}'dir. Bilginize. – {işletme adı}"

### 6.8 Ücretsiz / Premium
- `src/config/plans.ts` içinde sabitler:
  - Ücretsiz: **en fazla 10 aktif cari**, 1 kasa + 1 banka hesabı, tüm hareket tipleri, düzenli ödemeler ve hatırlatıcılar, temel özet raporlar.
  - **Premium:** sınırsız cari ve hesap, grafikli raporlar, Excel/PDF dışa aktarma, WhatsApp PDF ekstre, yedekleme / geri yükleme, belge (fotoğraf/PDF) ekleme.
- Sınıra gelindiğinde nazik bir paywall açılır; kullanıcının mevcut verisine asla dokunulmaz, sadece yeni ekleme engellenir.
- RevenueCat: `premium` entitlement'ı; aylık ve yıllık paket (fiyatlar RevenueCat panelinden yönetilecek, koda yazılmayacak). API anahtarları `.env` / `app.config.ts` üzerinden.
- Geliştirme ortamında Premium'u açıp kapatan gizli bir geliştirici anahtarı (sadece `__DEV__`).

---

## 7. Ekranlar

Alt sekmeler: **Ana sayfa · Cariler · [ + ] · Raporlar · Ayarlar**. Ortadaki **+** butonu accent renkte, yükseltilmiş; dokununca hareket tipi seçimi olan bir **BottomSheet** açılır (Tahsilat, Ödeme, Veresiye Satış, Veresiye Alış), seçim formu açar.

1. **İlk açılış (onboarding)** – 3 kısa ekran: (1) carilerini takip et, (2) kasanı ve bankanı gör, (3) hatırlatma al. Sonra: dil, para birimi, işletme adı (isteğe bağlı). Tamamlanınca MMKV'ye işaret.

2. **Ana sayfa**
   - Üst: logo + `tabulo` yazısı, sağda bildirim/hatırlatıcı simgesi.
   - **Primary renkte özet kartı:** "Net bakiye" (toplam alacak − toplam borç), ay seçici etiketi (accent), altında iki kutu: Alacak (+, positive) ve Borç (−, negative). Koyu kart üzerindeki yeşil/kırmızı tonlar açık tutulur (`#6EE7A0`, `#FCA5A5`).
   - **Hesap bakiyeleri:** yatay kaydırılan küçük kartlar (Kasa ₺…, Ziraat ₺…).
   - **Hızlı işlemler:** Tahsilat, Ödeme, Cari ekle, Ekstre (4 buton).
   - **Yaklaşan ödemeler:** ilk 3 düzenli ödeme + "Tümü".
   - **Vadesi gelen alacaklar:** vadesi geçmiş veya 7 gün içinde dolacak veresiye satışlar.
   - **Son işlemler:** son 5 hareket.

3. **Cariler**
   - Arama, filtre (Tümü / Müşteri / Tedarikçi / Borçlu olanlar / Pasifler), sıralama (ada göre, bakiyeye göre, son harekete göre).
   - Satır: baş harf avatarı (şahıs yuvarlak, şirket yuvarlatılmış kare), ad, il/ilçe, sağda bakiye (+/−).
   - Sağ üstte "Cari ekle".

4. **Cari detay**
   - Ad, kişi türü, telefon (dokununca ara), il/ilçe.
   - **Bakiye kartı:** "Size borçlu + ₺4.500" veya "Borcunuz − ₺1.200" veya "Hesap kapalı"; en yakın vade etiketi; butonlar: **Ekstre gönder** (primary), **Hatırlat** (accent kenarlıklı), WhatsApp mesajı.
   - Filtre: Tümü / Satışlar / Tahsilatlar / Ödemeler.
   - Hareket listesi aya göre gruplu; her satırda tür, tarih, tutar ve **o anki yürüyen bakiye**.
   - Alt sabit buton: **+ İşlem ekle** (accent).
   - Menü: Düzenle, Pasife al / Aktife al, Sil (hareketi olan cari silinemez, yalnızca pasife alınabilir).

5. **Cari ekle / düzenle** – 6.2'deki kurallar.

6. **Hareket ekle / düzenle** – 6.4'teki kurallar. BottomSheet veya tam ekran modal.

7. **Hareket detay** – Tüm alanlar, belge önizlemeleri (dokununca tam ekran), Düzenle, Sil.

8. **Tüm hareketler** (Ana sayfadan "Tümü") – tarih aralığı, hareket tipi, hesap, işlem türü, konu, cari filtreleri; arama (açıklama/belge no).

9. **Raporlar**
   - Dönem seçici: **Gün / Hafta / Ay / Yıl** + özel aralık; ileri/geri oklarıyla dönem değiştirme.
   - Özet kartları: Toplam gelir (tahsilatlar), Toplam gider (ödemeler), Net, Veresiye satışlar, Veresiye alışlar.
   - Grafikler (Premium): gelir-gider sütun grafiği (döneme göre alt kırılım: yıl → aylar, ay → günler/haftalar), işlem türüne göre gider dağılımı (yatay çubuk), konuya göre gider dağılımı, hesap bakiyeleri.
   - Ücretsiz kullanıcı özet kartlarını görür, grafik alanında Premium tanıtımı.
   - Sağ üstte **Dışa aktar** (Excel / PDF).

10. **Düzenli ödemeler** – liste + ekle/düzenle formu (6.5).

11. **Ayarlar**
    - İşletme profili (PDF başlığı için)
    - Hesaplar (Kasa/Banka yönetimi)
    - İşlem türleri (gelir/gider ayrı sekmeler; ekle, yeniden adlandır, sırala, pasife al)
    - İşlem konuları
    - Düzenli ödemeler
    - Dil (Türkçe / English), para birimi, tema (Açık / Koyu / Sistem)
    - Bildirimler (varsayılan hatırlatma saati)
    - Yedekleme ve geri yükleme
    - Premium / aboneliği yönet / satın alımları geri yükle
    - Gizlilik açıklaması, sürüm bilgisi

12. **Paywall** – RevenueCat Paywall UI veya özel ekran: Premium özelliklerin listesi, aylık/yıllık seçenek, "Satın alımları geri yükle", kullanım koşulları ve gizlilik bağlantıları.

---

## 8. Mobil deneyim kuralları

### 8.1 Klavye ve formlar
- Tüm formlar `KeyboardAwareScrollView` içindedir; odaklanan alan **her zaman klavyenin üstünde görünür**.
- Formun alt kısmındaki **Kaydet** butonu klavye açıkken de erişilebilir: `KeyboardStickyView` ile klavyenin hemen üstüne yapışır.
- iOS ve Android'de `KeyboardToolbar` (önceki / sonraki / bitti) gösterilir.
- Alanlar arası geçiş `returnKeyType="next"` ile; son alanda `"done"` kaydeder.
- Doğru klavye tipleri: tutar `decimal-pad`, telefon `phone-pad`, TC/Vergi No `number-pad`, e-posta `email-address` (büyük harf kapalı), ad/unvan `autoCapitalize="words"`.
- `autoComplete` / `textContentType` doğru ayarlanır (ad, telefon, e-posta, adres).
- Boş alana dokununca klavye kapanır; listelerde kaydırınca kapanır (`keyboardDismissMode`).
- BottomSheet içindeki formlarda klavye açılınca sheet yukarı kayar, içerik kesilmez.
- Doğrulama hatası olursa ilk hatalı alana otomatik kaydırılır ve odaklanılır; hata mesajı alanın hemen altında.
- Kaydedilmemiş değişiklikle çıkılmaya çalışılırsa (geri butonu, kaydırma hareketi, Android geri tuşu, sheet'i aşağı çekme) "Değişiklikler kaydedilmedi" onayı sorulur.
- Kaydederken buton devre dışı kalır ve yükleniyor gösterir; çift dokunuşla iki kayıt oluşmaz.
- Uzun formlarda (hareket ekleme) yarım kalan giriş taslak olarak MMKV'de tutulur; uygulama arka plana atılsa da kaybolmaz.
- **En küçük hedef ekran iPhone SE (375×667):** klavye açıkken bile tüm formlar eksiksiz kullanılabilir olmalı.

### 8.2 Güvenli alanlar ve ekran düzeni
- Tüm ekranlar safe area'ya uyar; alt sekme çubuğu ve alt sabit butonlar ev çubuğunun / Android gezinme çubuğunun üstünde kalır.
- Android'de edge-to-edge görünüm; içerik sistem çubuklarının altında kalmaz.
- Uygulama dikey yönde kilitli. İlk sürümde tablet desteği kapalı (`supportsTablet: false`).
- Telefonun yazı boyutu büyütüldüğünde metinler kesilmez, satırlar alta kayar. Yoğun alanlarda (sekme etiketleri, küçük rozetler) `maxFontSizeMultiplier` ile makul sınır konur.

### 8.3 Etkileşim
- Liste satırlarında kaydırma eylemleri: sola kaydır → **Sil**, sağa kaydır → **Düzenle**. Aynı eylemler uzun basınca açılan menüde de olur (kaydırmayı bilmeyenler için).
- Listelerde aşağı çekerek yenileme.
- Dokunsal geri bildirim: kaydetme (başarı), silme (uyarı), doğrulama hatası (hata). Ayarlar'dan kapatılabilir.
- Android geri tuşu: önce açık sheet/dialog/menüyü kapatır, sonra önceki ekrana gider; ana sayfada uygulamadan çıkar.
- iOS'ta kenardan kaydırarak geri gitme çalışır.
- Her dokunulabilir öğede basılı durum geri bildirimi var.
- Animasyonlar kısa (150–250 ms). Telefonda "Hareketi azalt" açıksa animasyonlar sadeleşir.
- Uzun işlemlerde (PDF/Excel üretimi, yedek) ilerleme göstergesi; ekran donmaz.

### 8.4 Uygulama yaşam döngüsü
- Splash ekranı, veritabanı migration'ı ve hazır veriler yüklenene kadar açık kalır (`SplashScreen.preventAutoHideAsync`).
- Uygulama ön plana geldiğinde: bildirimler senkronize edilir; gün değiştiyse "bugün", "yaklaşan" ve "gecikti" hesapları güncellenir.
- Bildirime dokununca ilgili ekran açılır (uygulama tamamen kapalıyken de çalışmalı).
- Beklenmeyen hatalarda Error Boundary: "Bir sorun oluştu" ekranı ve "Tekrar dene" butonu; veriler etkilenmez.

### 8.5 Güvenlik
- **Uygulama kilidi** (Ayarlar'dan açılır, varsayılan kapalı): açılışta ve uygulama belirli bir süre (anında / 1 dk / 5 dk) arka planda kaldıktan sonra Face ID / parmak izi / cihaz şifresi istenir.
- Uygulama arka plana geçerken son uygulamalar ekranında finansal veriler görünmesin: içerik yerine logo/bulanık ekran gösterilir.
- TC Kimlik No maskeli (bkz. 6.3).

### 8.6 İzinler
- İzinler **ihtiyaç anında** istenir ve öncesinde kısa bir açıklama gösterilir: kamera (fiş çekerken), fotoğraflar (galeriden seçerken), bildirim (ilk düzenli ödeme veya hatırlatıcı eklenirken).
- İzin reddedilirse uygulama çalışmaya devam eder; ilgili yerde telefon Ayarlar'ına yönlendiren bir açıklama gösterilir.
- iOS izin açıklama metinleri (`NSCameraUsageDescription` vb.) Türkçe ve İngilizce tanımlanır.

---

## 9. Web'e hazırlık (mimari kural)

**Bağlam:** 5–6 ay sonra bir web sürümü ve bulut senkronizasyonu (kullanıcı hesabı + telefon ile web arasında ortak veri) planlanıyor. **Şimdi sunucu veya web kodu yazılmayacak**, ama kod buna hazır olacak şekilde düzenlenecek:

1. **`src/core/` saf TypeScript'tir.** İçinde React Native, Expo veya herhangi bir mobil paket import edilemez (ESLint `no-restricted-imports` kuralıyla zorunlu tut). Buraya girenler:
   - Tutar ayrıştırma ve biçimlendirme (`money.ts`)
   - Doğrulamalar: TC, vergi no, telefon (`validation.ts`)
   - Hareket etkileri (`MOVEMENT_EFFECT`), bakiye ve rapor hesaplayan saf fonksiyonlar
   - Dönem hesapları (gün/hafta/ay/yıl aralıkları)
   - Zod form şemaları
   - Tasarım tokenları (renkler JS nesnesi olarak da dışa aktarılır)
   - Çeviri dosyaları (`tr.json`, `en.json`)
2. **Veri erişimi repository katmanından geçer** (`src/db/repositories/`). Ekranlar ve hook'lar doğrudan Drizzle sorgusu yazmaz; `contactsRepo.list()`, `transactionsRepo.create()` gibi fonksiyonlar çağırır. İleride bulut/senkronizasyon katmanına geçerken sadece bu katman değişir.
3. **Platforma özel işler arayüz arkasında** (`src/platform/`): bildirim, dosya kaydetme, paylaşım, biyometrik kilit, belge seçme.
4. **Şema kurallarına kesinlikle uy:** UUIDv7 kimlik, her güncellemede `updated_at`, sert silme yok (`deleted_at`), tutar tam sayı, tarih metin. Bunlar ileride Supabase + PowerSync gibi bir senkronizasyon çözümünün ön koşuludur.
5. **Belge dosyaları kimlikle adlandırılır** (`attachments/<attachmentId>.jpg`); ileride buluta yüklemek kolay olur.

---

## 10. Dışa aktarma ve yedekleme

### 10.1 PDF cari ekstresi
- A4, HTML şablonla (`expo-print`).
- Başlık: işletme logosu (varsa), adı, iletişim bilgileri; sağda "Cari Hesap Ekstresi", tarih aralığı.
- Cari bilgileri: ad/unvan, vergi no–vergi dairesi (şirketse), il/ilçe, telefon. TC Kimlik No varsayılan yok.
- Tablo: Tarih · Belge no · Açıklama · Borç · Alacak · Bakiye (yürüyen).
- Alt: devreden bakiye, dönem toplamları, **son bakiye** büyük puntoyla; "Tabulo ile oluşturuldu" küçük not (Premium'da kaldırılabilir).
- Dosya adı: `Ekstre_<CariAdi>_<YYYY-AA-GG>.pdf`

### 10.2 Excel
- Hareketler: Tarih, Hareket tipi, Hesap, İşlem türü, Konu, Cari, Açıklama, Belge no, Vade, Gelir, Gider, Tutar (sayı olarak, metin değil).
- İkinci sayfa: Cariler ve bakiyeleri. Üçüncü sayfa: Dönem özeti.
- Seçilen filtreler ve dönem uygulanır. Başlık satırı kalın ve dondurulmuş.

### 10.3 Yedekleme / geri yükleme (Premium)
- **Yedek al:** tüm tablolar + `schemaVersion` + oluşturulma tarihi tek bir JSON dosyasına (`tabulo-yedek-YYYY-AA-GG.json`); belgeler varsa JSON ile birlikte bir zip içinde. `expo-sharing` ile kullanıcı iCloud Drive / Google Drive / e-posta seçer.
- **Geri yükle:** `expo-document-picker` ile dosya seçilir, şema sürümü kontrol edilir, kullanıcıya "Mevcut veriler silinip yedekteki veriler yüklenecek" onayı gösterilir, işlem tek bir veritabanı transaction'ı içinde yapılır; hata olursa hiçbir şey değişmez.
- Ayarlar'da son yedek tarihi gösterilir; 30 günden eski ise nazik bir hatırlatma.

---

## 11. Klasör yapısı (öneri)

```
app/                        # Expo Router ekranları
  (tabs)/index.tsx          # Ana sayfa
  (tabs)/contacts/...       # Cariler
  (tabs)/reports.tsx
  (tabs)/settings/...
  transaction/new.tsx       # Hareket ekle (modal)
  onboarding/...
  paywall.tsx
src/
  core/                     # SAF TypeScript – mobil import YASAK (web ile paylaşılacak)
    money.ts                # tutar ayrıştırma/biçimlendirme (+ testler)
    validation.ts           # TC, vergi no, telefon (+ testler)
    ledger.ts               # MOVEMENT_EFFECT, bakiye ve rapor hesapları (+ testler)
    periods.ts              # gün/hafta/ay/yıl aralıkları
    forms/                  # zod şemaları
    theme/tokens.ts         # renk tokenları
    i18n/tr.json, en.json
  db/schema.ts              # docs/schema.ts buraya taşınır
  db/client.ts              # expo-sqlite + drizzle bağlantısı
  db/migrations/            # drizzle-kit çıktısı
  db/seed.ts
  db/repositories/          # contactsRepo, transactionsRepo, accountsRepo, reportsRepo ...
  platform/                 # notifications, files, sharing, biometrics, pickers
  components/ui/            # AmountInput, MoneyText, EmptyState, ListRow, FormScreen ...
  components/brand/Logo.tsx
  features/                 # contacts, transactions, recurring, reports, export, backup
  pdf/                      # HTML şablonları
  config/plans.ts
  stores/                   # zustand
assets/data/tr-il-ilce.json
global.css                  # Uniwind tema
```

---

## 12. Fazlar

Her fazın sonunda dur ve onay bekle.

**Faz 0 – Kurulum**
Expo projesi (TypeScript, Expo Router), dev client, Uniwind + HeroUI Native kurulumu ve tema (4.2'deki tüm tokenlar, açık/koyu, 4.4 kuralları, durum çubuğu ve gezinme çubuğu), Plus Jakarta Sans, i18n iskeleti (tr/en), ESLint/Prettier (`src/core` için mobil import yasağı dahil), jest-expo. Safe area ve keyboard-controller sağlayıcıları, ortak `FormScreen` bileşeni (KeyboardAwareScrollView + KeyboardToolbar + yapışkan Kaydet butonu). Logo bileşeni, uygulama ikonu ve splash (açık ve koyu). Boş alt sekme yapısı ve ortadaki + butonu.
*Test: uygulama iOS ve Android'de açılıyor, tema ve dil değiştirilebiliyor, açılışta beyaz flaş yok, örnek bir formda klavye alanları kapatmıyor.*

**Faz 1 – Veritabanı**
Drizzle + expo-sqlite bağlantısı, `schema.ts`, ilk migration, açılışta migration, hazır verilerin eklenmesi, repository katmanı, `src/core` içinde `money.ts`, `validation.ts`, `ledger.ts` + birim testleri, bakiye sorguları + testleri.
*Test: `npm test` geçiyor; hazır veriler bir kez ekleniyor.*

**Faz 2 – Cariler**
Cari listesi, arama/filtre/sıralama, cari ekle/düzenle (Şahıs/Şirket koşullu alanları, TC/vergi no doğrulama, il/ilçe seçimi, açılış bakiyesi → devir), pasife alma, ücretsiz sınır kontrolü.

**Faz 3 – Hareketler**
+ BottomSheet, hareket formu (koşullu alanlar, akıllı varsayılanlar, belge ekleme), hareket detay, düzenle, yumuşak silme + geri al, cari detay ekranı (bakiye kartı, yürüyen bakiyeli liste), tüm hareketler ekranı ve filtreler.

**Faz 4 – Ana sayfa ve tanımlar**
Ana sayfa (özet kartı, hesap bakiyeleri, hızlı işlemler, son işlemler, vadesi gelenler), Ayarlar altında hesaplar, işlem türleri, konular, işletme profili yönetimi.

**Faz 5 – Düzenli ödemeler ve hatırlatıcılar**
Düzenli ödeme listesi/formu, "Ödendi" akışı, yerel bildirimler, açılışta bildirim senkronizasyonu, tahsilat hatırlatıcıları, bildirime dokununca ilgili ekranın açılması, WhatsApp mesaj bağlantısı.

**Faz 6 – Raporlar**
Dönem seçici, özet kartları, victory-native grafikleri, kırılımlar.

**Faz 7 – Dışa aktarma**
PDF cari ekstresi, PDF dönem raporu, Excel dışa aktarma, WhatsApp/paylaşım.

**Faz 8 – Yedekleme**
Yedek al / geri yükle (zip + JSON), son yedek hatırlatması.

**Faz 9 – Premium**
RevenueCat entegrasyonu, paywall, özellik kilitleri (6.8), satın alımları geri yükle, geliştirici anahtarı.

**Faz 10 – Son rötuşlar**
Onboarding, boş durumlar, yükleniyor iskeletleri, erişilebilirlik etiketleri (`accessibilityLabel`), uygulama kilidi ve arka plan gizliliği (8.5), Bölüm 4.4 ve Bölüm 8'in tamamının ekran ekran kontrolü (koyu tema, klavye, küçük ekran, büyük yazı, Android geri tuşu, izin akışları), İngilizce çevirilerin tamamlanması, performans (1.000+ cari, 10.000+ hareketle akıcılık), EAS Build yapılandırması (iOS + Android), mağaza için ekran görüntüsü önerileri.

---

## 13. Kabul kriterleri (her faz için geçerli)

- TypeScript hatası yok, testler geçiyor.
- `src/core` içinde React Native / Expo importu yok; ekranlar veriye repository katmanı üzerinden erişiyor.
- Bileşenlerde sabit renk yok; o fazda yapılan her ekran açık ve koyu temada kontrol edildi.
- O fazdaki her form iPhone SE boyutunda, klavye açıkken eksiksiz kullanılabiliyor; odaklanan alan ve Kaydet butonu görünür.
- Android geri tuşu ve iOS geri kaydırma hareketi beklendiği gibi çalışıyor.
- Arayüzde koda gömülü metin yok; tr ve en çeviri anahtarları eksiksiz.
- Tüm tutarlar `money.ts` üzerinden ayrıştırılıyor ve biçimleniyor; ondalıklı sayı (`float`) ile para hesabı yapılmıyor.
- Bakiyeler `MOVEMENT_EFFECT` ve SQL sorgularıyla hesaplanıyor, hiçbir yerde saklanmıyor.
- Açık ve koyu temada okunaklı; dokunma alanları ≥ 44 px; tutarlarda +/− işareti var.
- Uygulama internetsiz tam çalışıyor (Premium doğrulaması hariç).
