# Tabulo

Küçük esnaf için cari hesap ve gelir-gider takip uygulaması (Expo / React Native, sunucusuz, veriler cihazda).

- **Tam şartname:** [docs/PROMPT.md](docs/PROMPT.md). İş kuralları, ekranlar ve fazlar oradadır; bu dosya yalnızca durumu ve alınan kararları özetler.
- **Veri yapısının tek doğruluk kaynağı:** [src/db/schema.ts](src/db/schema.ts) (Faz 1'de `docs/`'tan taşındı). Değişiklik gerekiyorsa önce gerekçesiyle kullanıcıya öner; sonra `npm run db:generate` ile yeni migration üret.
- **Expo genel kuralları:** @AGENTS.md

## Çalışma şekli

- İş, PROMPT.md Bölüm 12'deki fazlara göre yürür. **Her fazın sonunda dur**, özetle, nasıl test edileceğini yaz ve kullanıcının "devam" demesini bekle.
- Emin olunmayan iş kuralında tahmin etme, sor.
- Paket kurmadan önce resmi dokümana bak; prompt ile doküman çelişirse dokümanı uygula ve kullanıcıya söyle.
- Faz sonunda hepsi temiz olmalı: `npx tsc --noEmit`, `npx eslint .`, `npm test`.

## Faz durumu

| Faz                                   | Durum                                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 0 – Kurulum                           | ✅ Tamamlandı (iOS doğrulandı; Android yerel derleme JDK 17 bekliyor, aşağıya bkz.)                                       |
| 1 – Veritabanı                        | ✅ Tamamlandı ve onaylandı (kullanıcı geri bildirimiyle para biçimi / varsayılan hesaplar / hazır kayıt dili güncellendi) |
| 2 – Cariler                           | ✅ Tamamlandı (iOS'ta liste/form görsel olarak doğrulandı)                                                                |
| 3 – Hareketler                        | ✅ Tamamlandı ve onaylandı                                                                                                |
| 4 – Ana sayfa                         | ✅ Tamamlandı                                                                                                             |
| 5 – Düzenli ödemeler / hatırlatıcılar | ✅ Tamamlandı (iOS'ta bildirim + dokununca ekran açılması kullanıcı tarafından doğrulandı)                                |
| 6 – Raporlar                          | ✅ Tamamlandı                                                                                                             |
| 7 – Dışa aktarma                      | ✅ Tamamlandı                                                                                                             |
| 8 – Yedekleme                         | ✅ Tamamlandı                                                                                                             |
| 9 – Premium                           | ✅ Tamamlandı (onay bekliyor; Test Store anahtarıyla satın alma kullanıcı tarafından denenecek)                           |
| 10 – Son rötuşlar                     | 🟡 Kod tamam (onay bekliyor; iOS'ta Face ID / kilit ve Android cihaz testi kullanıcıda)                                   |

### Faz 0'da yapılanlar

- Expo Router (dosya tabanlı rotalar `app/` altında, kökte), dev client, TypeScript `strict` + `noUncheckedIndexedAccess`.
- Uniwind + HeroUI Native teması: [global.css](global.css). Plus Jakarta Sans 400–800.
- Tema ve dil tercihi: Zustand + MMKV ([src/stores/preferences.ts](src/stores/preferences.ts)); i18n kurulumu [src/lib/i18n.ts](src/lib/i18n.ts), çeviriler `src/core/i18n/{tr,en}.json`.
- Ortak bileşenler: `FormScreen`, `FormField`, `SegmentedControl`, `AppText`, `EmptyState`, `TabScreen` (`src/components/ui/`); `Logo` / `LogoMark` (`src/components/brand/`).
- Alt sekmeler: özel [TabBar](src/components/navigation/TabBar.tsx) + ortadaki + butonunun açtığı [AddMovementSheet](src/components/navigation/AddMovementSheet.tsx). Sekme ekranları ve `app/transaction/new.tsx` şimdilik yer tutucu.
- Yalnızca `__DEV__`: `app/dev/form-demo.tsx` (klavye testi için örnek form; Ayarlar → Geliştirici).
- İkon ve splash `docs/designs/` dosyalarından (`assets/images/`); splash'in açık ve koyu varyantı var.
- Error Boundary: [src/components/ErrorScreen.tsx](src/components/ErrorScreen.tsx).
- Testler: tokens ↔ global.css tutarlılığı; tr/en anahtar ve yer tutucu eşitliği; dil seçimi.

### Faz 1'de yapılanlar

- `src/db/`: `schema.ts`, `client.ts` (expo-sqlite, WAL + foreign_keys), `migrations/` (drizzle-kit çıktısı, elle düzenleme), `seed.ts`, `ledgerSql.ts`, `useDatabaseSetup.ts`; açılışı [DatabaseGate](src/components/DatabaseGate.tsx) yönetir (splash'i o kapatır, hata olursa "Tekrar dene").
- Repository'ler `src/db/repositories/` (fabrika: `createXRepo(db)`); uygulama `import { contactsRepo } from '@/db'` kullanır. Dış API `async`, içeride senkron Drizzle çağrıları.
- `src/core`: `money.ts`, `validation.ts`, `ledger.ts` (MOVEMENT_RULES, validateMovement, yürüyen bakiye), `errors.ts` (DomainError kodları).
- Kullanıcı geri bildirimiyle (Faz 1 sonu): para biçimi, varsayılan Kasa + Banka hesabı, hazır kayıt adlarının dile uyması (`localizeSeedRecords`).
- Testler: `src/db/testing.ts` → Node'un yerleşik `node:sqlite`'ı üzerinde gerçek migration'larla bellek içi DB. SQL bakiyelerinin saf ledger fonksiyonlarıyla eşitliği rastgele veriyle test edilir.

### Faz 2'de yapılanlar

- Cari listesi [app/(tabs)/contacts.tsx](<app/(tabs)/contacts.tsx>): arama, filtre (Tümü / Müşteri / Tedarikçi / Borçlu olanlar / Pasifler), sıralama (ad / bakiye / son hareket), FlashList, aşağı çekip yenileme, kaydırma eylemleri + uzun basma menüsü, sil → 5 sn "Geri al".
- Cari formu [src/features/contacts/ContactForm.tsx](src/features/contacts/ContactForm.tsx) (`/contact/new`, `/contact/[id]/edit`): Şahıs/Şirket koşullu alanlar, TC / Vergi No doğrulama, il/ilçe aranabilir seçim, açılış bakiyesi → Devir, aktif/pasif, kaydedilmemiş değişiklik onayı.
- Ortak: `useLiveQuery` (repository sorgusu + DB değişince yenile), `BusinessProvider` / `useMoney`, `MoneyText`, `AmountInput`, `PickerField`, `ActionSheet`, `FormSection`, `useConfirmDiscard`, `zodResolver`, `haptics`.
- `src/core`: `forms/contact.ts` (zod şeması, hata mesajı = çeviri anahtarı), `text.ts` (Türkçe katlamalı arama, baş harf), `turkeyRegions.ts`, `dates.ts`; `src/config/plans.ts` (ücretsiz sınırlar).

### Faz 3'te yapılanlar

- Hareket formu [TransactionForm](src/features/transactions/TransactionForm.tsx) (`/transaction/new?type=&contactId=`, `/transaction/[id]/edit`, ikisi de modal): üstte tutar, 2×2 hareket tipi, alanlar `MOVEMENT_RULES`'a göre; akıllı varsayılanlar (son hesap MMKV'de `lastAccountId`, "Genel" konusu `subjectsRepo.findDefault`, bugün); taslak MMKV'de (`stores/transactionDraft.ts`); "Kaydedildi" + "Yeni ekle".
- Belgeler: [src/platform/attachments.ts](src/platform/attachments.ts) (kamera / galeri / PDF, fotoğraf uzun kenar 1600 px JPEG 0.7), `attachmentsRepo`, tam ekran görüntüleyici `app/attachment-viewer.tsx`, PDF sistem paylaş/önizle ekranında.
- Hareket detayı `app/transaction/[id]/index.tsx`; cari detayı `app/contact/[id]/index.tsx` (bakiye kartı, FIFO vade etiketi, cari tipine göre filtre, aya göre gruplu yürüyen bakiyeli liste, + İşlem ekle → Devir dahil); tüm hareketler `app/transactions.tsx` (arama + filtre paneli). Ana sayfada geçici "Tüm hareketler" girişi (Faz 4'te "Son işlemler → Tümü"ye taşınacak).
- Ortak: `ChipGroup`, `DateField`, `SwipeableRow`, `PickerField` artık `{ value, label, description }` seçenekleri alır (`textOptions` basit liste için), `useDates`, `formatPhone`.
- `src/core`: `dates.ts` (UTC tabanlı gün hesapları, `formatDate`), `grouping.ts`, `forms/transaction.ts`, `ledger.ts`'e `openItems` / `nearestDue` (FIFO), `generalDisplay` / `contactViewDisplay`.
- Ekstre gönder şimdilik "Yakında" diyaloğu (Faz 7); Hatırlat ve WhatsApp Faz 5'te bağlandı.

### Faz 4'te yapılanlar

- Ana sayfa [app/(tabs)/index.tsx](<app/(tabs)/index.tsx>): özet kartı (`contactsRepo.totals(asOf)`, ay seçici `MonthPickerSheet`), hesap kartları (dokununca `/transactions?accountId=`), hızlı işlemler, vadesi gelen alacaklar (`transactionsRepo.dueReceivables`, FIFO; 5'ten fazlaysa `/due-receivables`), son 5 hareket. Ekstre "Yakında" (Faz 7).
- Ayarlar: İşletme profili (`/settings/business`, logo `logo/<id>.jpg` 512 px), Para birimi (`/settings/currency`), Hesaplar (`/settings/accounts`, form `new` / `[id]`, IBAN mod-97), İşlem türleri ve konular (`DefinitionsScreen`, `NameDialog`; yukarı/aşağı taşı, pasife al, sil + geri al).
- `src/core`: `exchange.ts` (kur, BigInt dönüştürme), `order.ts` (`moveId`), `forms/account.ts`, `forms/business.ts`, `validation.ts`'e IBAN; `dates.ts`'e `monthsBetween`; `useDates().day` → "Bugün / Dün".
- Özet kartı tokenları `summary*` (iki temada lacivert kart).

### Faz 5'te yapılanlar

- `expo-notifications` (config plugin: Android beyaz simge `assets/images/notification-icon.png`, `scripts/notification-icon.py` ile logodan üretildi). Native modül → dev client yeniden derlendi.
- Düzenli ödemeler: liste `/recurring`, form `/recurring/new` + `/recurring/[id]`, "Ödendi" modalı `/recurring/[id]/pay` (tutar/tarih/hesap düzenlenebilir, 5 sn geri al). `recurringPaymentsRepo.markPaid` hareketi oluşturur ve `nextOccurrence` ile tarihi ilerletir; bitiş tarihi geçilince pasif (= "Tamamlandı").
- Tahsilat hatırlatıcıları: cari detayında "Hatırlat" → `/reminders/new?contactId=`; carinin bekleyen hatırlatıcıları bakiye kartının altında; ana sayfa zili → `/reminders` (zamanı gelen sayısı rozette).
- Bildirimler: `src/core/notificationPlan.ts` (hangi bildirim ne zaman; en fazla 60, iOS 64 sınırı), `src/platform/notifications.ts` (izin, eşitleme, dokunma), `NotificationSync` (açılış, ön plana gelme, ilgili tablo değişimi, dil/para birimi değişimi). Kimlikler kayıttan türetilir (`recurring-<id>`, `reminder-<id>`). Dokununca: düzenli ödeme → Ödendi ekranı, hatırlatıcı → cari detayı.
- İzin ilk düzenli ödeme / hatırlatıcı kaydında, önce açıklama diyaloğuyla istenir; reddedildiyse `PermissionBanner` Ayarlar'a yönlendirir.
- WhatsApp: cari detayında düzenlenebilir mesaj diyaloğu → `https://wa.me/<telefon>?text=`; mesaj bakiye durumuna göre (borçlu / borcumuz / kapalı), işletme adı varsa imza.
- Ana sayfa "Yaklaşan ödemeler" (ilk 3 aktif, satıra dokununca Ödendi ekranı). Ayarlar: Hatırlatmalar grubu + varsayılan hatırlatma saati (MMKV `defaultRemindTime`). `useToday` gün değişince / ön plana gelince yeniler.
- Ortak: `TimeField`, `src/core/recurrence.ts`, `dates.ts`'e saat yardımcıları (`isTimeOfDay`, `formatTimeOfDay`, `localDateTime`), `core/whatsapp.ts`.

### Faz 6'da yapılanlar

- `@shopify/react-native-skia` 2.6.2 (SDK 57 sürümü) + `victory-native` 42 → dev client yeniden derlendi.
- Raporlar [app/(tabs)/reports.tsx](<app/(tabs)/reports.tsx>): dönem seçici (Gün / Hafta / Ay / Yıl / Özel, ‹ › okları, "Bu aya dön"), özet kartları (Net, Gelir, Gider, Veresiye satış/alış), gelir-gider sütun grafiği (victory-native `BarGroup`, basılı tutunca dilim ayrıntısı), işlem türüne / konuya göre gider, dönem sonundaki hesap bakiyeleri. Dışa aktar "Yakında" (Faz 7).
- Kırılımlar: kutucuğa veya satıra dokununca `/transactions?from=&to=&types=&transactionTypeId=&subjectId=&accountId=` (`filtersFromParams`).
- `src/core/periods.ts` (dönem, kaydırma, dilimler, etiketler), `money.ts`'e `compactAmount` (eksen: `15 B`, `1,3 Mn`), `dates.ts`'e `weekday` ve yeni `DateStyle`'lar.
- `reportsRepo` (`summary`, `dailyIncomeExpense`, `expensesByType`, `expensesBySubject`); `accountsRepo.listWithBalances({ asOf })`.

### Faz 7'de yapılanlar

- `expo-print` (native → dev client yeniden derlendi) ve SheetJS `xlsx` 0.20.3 (SheetJS dokümanındaki CDN tarball'ı; npm'deki `xlsx` 0.18.5'te kaldı).
- Ekstre `/export/statement?contactId=` (modal): cari seçimi (ana sayfa "Ekstre"den gelirse), dönem Tümü / Bu ay / Geçen ay / Bu yıl / Özel, canlı özet, "Kimlik numaralarını dahil et" (yalnızca TC'si olan şahıs). Cari detayındaki "Ekstre gönder" ve ana sayfa "Ekstre" buraya bağlı.
- Dışa aktar `/export/report` (modal): Raporlar'dan `source=report&unit&from&to` (PDF dönem raporu / Excel), Tüm hareketler'den `source=transactions` + filtreler ve arama (yalnızca Excel).
- `src/core/statement.ts` (devreden bakiye, Borç/Alacak, yürüyen bakiye, `balanceSide`), `fileNames.ts` (ASCII dosya adı), `summary.ts` (Excel dönem özeti). `src/pdf/` saf HTML şablonları (`html.ts`, `statement.ts`, `report.ts`). `src/features/export/` (`documents.ts` metin/biçim → şablon, `workbook.ts` SheetJS, `exporters.ts` repo → dosya, `useExport.ts`). `src/platform/exportFiles.ts` (A4 PDF, base64 dosya, paylaş, logo → data URI). Dosyalar `cache/exports/`'a yazılır, her dışa aktarmada eskiler silinir.
- Testler: ekstre hesapları, dosya adları, özet; gerçek çevirilerle HTML (kaçış, B/A, KVKK) ve Excel (SheetJS ile geri okunarak: sayfalar, sayı hücreleri, tarih seri no, kimlik sütunu).

### Faz 8'de yapılanlar

- `fflate` 0.8.3 (saf JS zip; native modül yok, dev client yeniden derlenmedi).
- Ayarlar → Veriler → Yedekleme ve geri yükleme (`/settings/backup`): son yedek tarihi, 30 gün hatırlatması (Ayarlar'da da uyarı kartı), Yedek al → paylaş ekranı, Yedekten geri yükle → dosya seçici → özetli onay → geri yükle.
- `src/core/backup.ts` (biçim, `parseBackup` doğrulaması, `BACKUP_SCHEMA_VERSION` = migration sayısı, dosya adı, hatırlatma), `backupRepo` (`exportTables`, `restore` tek transaction, `hasData`), `src/lib/zipStream.ts` (1 MB parçalarla zip yaz/oku), `src/platform/backupFiles.ts`, `src/features/backup/`.
- Yan düzeltme: SDK 57'de `File.move/copy` Promise döner; belge, logo ve PDF'teki beklenmeyen çağrılar `await` edildi.
- Simülatörde gerçek API'lerle gidiş-dönüş denendi (zip + belge, veriler birebir aynı, `unzip -t` temiz).

### Faz 9'da yapılanlar

- `react-native-purchases` 10.15 (native → dev client yeniden derlendi). `react-native-purchases-ui` kurulmadı: paywall özel ekran (kullanıcı kararı).
- Anahtarlar `.env` (`.env.example`): `EXPO_PUBLIC_REVENUECAT_TEST_KEY` (yalnızca `__DEV__`), `_IOS_KEY`, `_ANDROID_KEY`. Seçim `selectRevenueCatKey` ([plans.ts](src/config/plans.ts)); sürüm derlemesinde `test_` anahtarı asla seçilmez (SDK bilerek çöker). Anahtar yoksa uygulama çalışır, paywall "kullanılamıyor" der.
- [src/platform/purchases.ts](src/platform/purchases.ts) (configure, durum, dinleyici, aylık/yıllık paket, satın al, geri yükle, aboneliği yönet); `PremiumSync` (açılış, ön plana gelme, SDK dinleyicisi); durum MMKV'de `stores/premium.ts` (`entitled`, `expiresAt`, geliştirici `override`). `useIsPremium` → `resolvePremium` (süresi geçmiş saklı abonelik Premium sayılmaz).
- Paywall `/paywall?feature=` (modal): neden metni, özellik listesi (açan özellik vurgulu), paket kartları (fiyat mağazadan), yenileme açıklaması, geri yükle, koşullar / gizlilik ([legal.ts](src/config/legal.ts)); Premium ise "Aboneliği yönet".
- Kilitler `usePremiumGate(feature)` (değilse paywall açar): cari ve hesap sınırı (eski açıklama diyaloğu yerine), Raporlar grafik + dağılımlar + hesap bakiyeleri (`PremiumTeaser`, özet kartları ücretsiz), Raporlar ve Tüm hareketler "Dışa aktar", Ekstre (cari detayı + ana sayfa), Yedek al, belge ekleme. `/export/*` derin bağlantıyla açılırsa `PremiumRequiredScreen`.
- Ayarlar: Premium grubu (durum, Aboneliği yönet, Satın alımları geri yükle); `__DEV__`'de Premium Otomatik / Açık / Kapalı.
- Abonelik tarihi (kullanıcı isteği): `subscriptionTerm` (`expiresAt` + `willRenew`). Paywall'un Premium halinde durum kartı özellik listesinin üstünde: "Yenilenme tarihi: …" veya iptal edilmişse uyarı renginde "sona erecek: …". Ayarlar satırı yenilenecekse "Aktif", iptal edilmişse "Bitiş: …". Ömür boyu / ücretsizde tarih yok.

### Faz 10'da yapılanlar

- `expo-local-authentication` + `expo-screen-capture` (native → dev client yeniden derlendi). Face ID metni TR/EN (`assets/locales`).
- Onboarding `app/onboarding.tsx`: 3 tanıtım sayfası (kaydırmalı, Atla) + kurulum (dil, para birimi, isteğe bağlı işletme adı, "Yedekten geri yükle" → `/settings/backup`). `(tabs)/_layout` `onboardingDone` değilse yönlendirir. Tercihler persist sürümü 2: sürüm 1 kaydı olan (önceden kurulmuş) uygulamada onboarding atlanır.
- Uygulama kilidi [AppLock](src/features/security/AppLock.tsx): açılışta ve arka planda `Hemen / 1 dk / 5 dk` kaldıktan sonra (`core/appLock.ts`). Arka plana geçerken hemen logo örtüsü, dönüşte süre dolmadıysa kalkar (kilitliye dönerken içerik bir an bile görünmez). Örtü iOS'ta `FullWindowOverlay` (native modal ekranların da üstünde), Android'de RN `Modal`. Açma/kapama önce kimlik doğrulatır (`useAppLockToggle`); cihazda ekran kilidi yoksa açılmaz.
- Son uygulamalarda gizle (varsayılan açık): iOS `enableAppSwitcherProtectionAsync` (bulanık), Android `FLAG_SECURE` (bu sırada ekran görüntüsü alınamaz; kapatılabilir).
- Ayarlar: Güvenlik grubu (kilit, kilit süresi, gizle), Görünüm'de "Titreşimli geri bildirim" (`haptics` artık tercihi okur). Ortak `SettingsSwitchRow`.
- Yükleniyor iskeletleri `ListSkeleton` / `CardsSkeleton` (HeroUI Skeleton): cari listesi, tüm hareketler, cari detayı, ana sayfa son işlemler, raporlar özet, düzenli ödemeler, hatırlatıcılar.
- Performans: `sampleDataRepo.insert` (tohumlu örnek veri; Ayarlar → Geliştirici "Örnek veri ekle", yalnızca `__DEV__`) ve `performance.test.ts` (1.000 cari + 10.000 hareket, her sorgu < 400 ms; Node'da hepsi < 50 ms). `transactionsRepo.search` arama yoksa LIMIT/OFFSET'i SQL'de uygular (ana sayfa son 5: 38 → 1 ms).
- EAS: [eas.json](eas.json) (development, development-simulator, preview, production; `appVersionSource: remote`, production `autoIncrement`). Adımlar ve ekran görüntüsü önerileri [docs/store-release.md](docs/store-release.md).
- Yayın öncesi: Android'de kullanılmayan izinler `android.blockedPermissions` ile kaldırıldı (RECORD_AUDIO, SYSTEM_ALERT_WINDOW, READ/WRITE_EXTERNAL_STORAGE); `/dev/form-demo` sürüm derlemesinde ana sayfaya yönlendirir. `expo-doctor` 21/21, `expo export` iOS + Android temiz.
- Erişilebilirlik taraması: tüm `Pressable`'larda rol var, simgeli olanlarda etiket var; İngilizce çeviride Türkçe kalan metin yok.

## Alınan kararlar

- **Drizzle 1.0 RC** (`drizzle-orm` / `drizzle-kit` `1.0.0-rc.4`, tam sürüm sabit): Drizzle'ın Expo dokümanı `@rc` kurulumunu söylüyor. RC'nin `useMigrations` tipi `journal` bekliyor ama migrator kullanmıyor → `useDatabaseSetup.ts`'te bilinçli cast.
- **Drizzle tek tablolu sorguda sütunları tablo adı olmadan yazar** → ilişkili (correlated) alt sorgu yazma; bakiyeler gruplanmış alt sorgu + LEFT JOIN ile.
- **Sync sürücü:** `db.transaction` gövdesi senkron olmalı (`.run()/.all()`), içinde `await` yok.
- **Drizzle `.get()` yasak (src/db, ESLint):** expo-sqlite sürücüsü `.get()`te ifadeyi ilk satırda açık bırakıyor → sonraki COMMIT "SQL statements in progress" ile başarısız ("İşlem tamamlanamadı"). Tek satır için `.all()[0]`. Node testleri bunu yakalamaz (node:sqlite ifadeyi sıfırlıyor); repository değişikliklerini simülatörde de dene.
- **`src/core` → `@/db/schema` importu serbest** (ESLint istisnası); başka `@/db/*` yasak. MOVEMENT_EFFECT tek kaynak.
- **Hazır veri işareti:** `business_profile` satırı. Adlar `seed` çeviri anahtarlarından; TR adlarının şemadaki `SEED_*` ile aynı olduğunu test kontrol eder. Para birimi ilk açılışta cihaz bölgesinden (TRY/GBP/USD, değilse TRY).
- **Varsayılan hesaplar: "Kasa" (cash) + "Banka" (bank)** (kullanıcı kararı; şemadaki `SEED_ACCOUNTS`). Silme koruması: yalnızca "hareketi varsa silinemez".
- **Hazır kayıt adları uygulama diline uyar** (kullanıcı kararı): her açılışta ve dil değişince `localizeSeedRecords`. Adı hâlâ herhangi bir dildeki varsayılan olan kayıtlar çevrilir, kullanıcının yeniden adlandırdıklarına dokunulmaz (şema değişikliği gerekmedi). İngilizce adlar **ABD kullanımına** göre (Payroll, Payroll Taxes, Natural Gas, Service Revenue…).
- **Para gösterimi (kullanıcı kararı, tasarımdaki `₺1.500` yerine):** Türkçede simge sonda ve her zaman 2 ondalık → `1.500,55 ₺`, `3.450,00 ₺`; İngilizcede simge başta → `£25,450.65`. Sayı–simge ve işaret–tutar arası bölünmez boşluk (U+00A0). İşaretli: `+ 1.500,00 ₺` / `− 640,00 ₺` (U+2212). Hepsi `formatMoney` / `formatSignedMoney`.
- **İl/ilçe verisi:** `assets/data/tr-il-ilce.json` — kaynak [snrylmz/il-ilce-json](https://github.com/snrylmz/il-ilce-json) (ADNKS 2022), [hsndmr/turkiye-city-county-district-neighborhood](https://github.com/hsndmr/turkiye-city-county-district-neighborhood) ile birebir karşılaştırıldı: 81 il, 973 ilçe. Türkçe büyük/küçük harf dönüşümü yapıldı, ilçeler `Intl.Collator('tr')` ile sıralı (test kontrol eder).
- **TC Kimlik No (kullanıcı kararı, §6.2'den sapma):** yalnızca 11 hane, rakam ve ilk hane 0 olmasın. Kontrol hanesi algoritması **uygulanmaz** (`nationalIdIssue`).
- **"Türkiye ayarı" = uygulama dili `tr`:** TC/Vergi No doğrulaması, il/ilçe listesi, Vergi Dairesi alanı yalnızca Türkçede. İngilizcede "Tax ID", "Company / VAT No", serbest metin şehir/eyalet. Telefon varsayılan ülke kodu işletme para biriminden.
- **Arama ve ada göre sıralama JS'te** (`contactsRepo.list`): SQLite LIKE/NOCASE Türkçe harfleri doğru karşılaştırmıyor. Katlama iki yönlü ("çe" araması "Cem"i de bulur).
- **`@hookform/resolvers` kurulmadı:** isteğe bağlı peer'leri (typebox, effect) drizzle-orm RC ile çakışıyor; yerine [src/lib/zodResolver.ts](src/lib/zodResolver.ts). `--legacy-peer-deps` kullanma.
- **Kaydedilmemiş değişiklik:** [useConfirmDiscard](src/lib/useConfirmDiscard.ts) `usePreventRemove`'u `expo-router/build/react-navigation/core`'dan alır (SDK 57'de genel API'de yok, SDK 58'de `expo-router`'dan). `beforeRemove` dinleme native-stack'te çalışmaz. Kökte `headerBackButtonMenuEnabled: false`. Koruma `isDirty`'ye bağlı, başarılı kayıtta `leave()`. React Navigation API'leri `expo-router`'dan import edilir, `@react-navigation/*`'tan değil.
- **HeroUI Input'ta `min-h-*` sınıfı çalışmaz** (`.input__input` ezer); çok satırlı alan yüksekliği `FormField` içinde `style` ile.
- **Ücretsiz sınır** ([plans.ts](src/config/plans.ts), 10 aktif cari): yeni cari eklerken ve pasif cariyi aktife alırken `useContactLimit` → paywall (nedeni başlıkta).
- **`babel.config.js` var** (Drizzle `.sql` inline-import için) → `babel-preset-expo` dev bağımlılığı olarak kurulu olmalı. uuid 14 yalnızca ESM → jest `transformIgnorePatterns`'e eklendi.

- **Expo SDK 57** (58 değil): SDK 58 gesture-handler 3.x ile geliyor, `heroui-native` ise `^2.28` istiyor. SDK 57 tüm HeroUI peer bağımlılıklarını karşılıyor. Yükseltmeden önce HeroUI'nin desteğini kontrol et.
- **iOS 27 / Xcode 27:** UIScene yaşam döngüsü zorunlu; `expo-build-properties` → `ios.enableSceneSupport: true` ([app.config.ts](app.config.ts)). Bu ayar olmadan uygulama açılışta çöküyor. SDK 58'de kaldırılabilir.
- **Jest 29** (30 değil): `jest-expo@57` Jest 29 kullanıyor. Dev bağımlılıklarında `expo install` jest-expo için yanlış (SDK 58) sürüm seçiyor; sürümü elle sabitle.
- **TypeScript 6:** `@types` artık otomatik dahil edilmiyor → tsconfig'de `"types": ["jest", "node"]`; `*.css` importu için `src/types/css.d.ts`.
- **Renkler:**
  - HeroUI `accent` = bizim kehribar ana eylem rengi; `success` = `positive`, `danger` = `negative`, `warning` = `accent`.
  - `primary`, `positive`, `negative`, `warning-bg`, `warning-fg` için Tailwind sınıfları `@theme inline` ile tanımlandı.
  - Tasarımdan iki ek ton alındı: `separator` (`#EEF0F3`) ve `surface-secondary` (`#EAF0F7`); koyu karşılıkları bu projede belirlendi.
- **Renk kullanımı:** bileşenlerde sabit hex yasak. className kullanılamayan yerlerde (lucide simgeleri, sistem çubukları, klavye araç çubuğu) `useColors()` ([src/lib/theme.ts](src/lib/theme.ts)) kullanılır. Yeni renk eklerken **hem `global.css` hem `tokens.ts`** güncellenmeli (test bunu kontrol eder). Logo için `brandColors` istisnadır.
- **HeroUI buton köşeleri** global.css'te 12/14/16 px'e çekildi (varsayılanı hap şekli); etiketler kalın. Butonlarda köşe için className ile uğraşma.
- **Font adları** expo-font anahtarlarıdır (`PlusJakartaSans_700Bold` …); JS'te `fontFamilies` (tokens.ts) kullanılır. Metin için `AppText` + `weight` prop'u.
- **Rotalar:** sekme ekranları düz dosyalar (`app/(tabs)/contacts.tsx` …). Detay ekranları sekmelerin dışına, kök Stack'e konacak; böylece alt sekme çubuğu detay ekranlarında gizlenir.
- **`src/core` saf TypeScript'tir:** React/Expo/mobil paket ve `@/components`, `@/lib`, `@/stores` vb. importları ESLint ile yasak ([eslint.config.js](eslint.config.js)).
- **Uniwind tipleri:** `src/uniwind-types.d.ts` Metro tarafından üretilir ve repoya dahildir. Metro çalışmıyorsa şununla üret: `npx uniwind generate-artifacts --css ./global.css --dts ./src/uniwind-types.d.ts`.
- **Paket kimliği:** `com.lemartsoft.tabulo` (iOS ve Android; kullanıcı kararı, mağaza öncesi `app.tabulo`dan değişti). Mağazada kullanıldıktan sonra değiştirilemez.
- **Android:** mağaza derlemeleri EAS Build ile (Faz 10). Yerel emülatör testi için JDK 17 gerekir (makinede yalnızca JDK 25 var, RN 0.86 CMake adımı onunla başarısız); kullanıcı isterse kurulacak.
- **Renkler** kullanıcı tarafından şimdilik uygun bulundu; Faz 4'te özet kartı koyu temada ayrıca kontrol edilecek.

- **Vade etiketi FIFO ile (kullanıcı kararı, Faz 3):** tahsilatlar en eski borç kaleminden düşülür; tamamen kapanan veresiyenin vadesi gösterilmez. Açık kalan en erken vade gösterilir, geçmişse "Gecikti". Ana sayfadaki "Vadesi gelen alacaklar" da `openItems` ile yapılmalı.
- **Cari detay filtreleri cari tipine göre (kullanıcı kararı):** Müşteri: Tümü / Satışlar / Tahsilatlar / Ödemeler; Tedarikçi: Satışlar yerine Alışlar; İkisi: hepsi. Tasarımdaki segment yerine yatay çip satırı (5 seçenek ve büyük yazıda sığsın diye).
- **Belge ekleme Premium (Faz 9):** yalnızca yeni belge eklemek kilitli; kayıtlı belgeler ücretsiz planda da görünür ve kaldırılabilir.
- **Belge yolu göreli saklanır** (`attachments/<id>.jpg`): iOS uygulama klasörünün mutlak yolu güncellemede değişir; `resolveAttachmentUri` ile açılır. Silinen belgenin dosyası yumuşak silme gereği diskte kalır (temizlik ileride, yedekleme fazında ele alınabilir).
- **Tutarın işareti/rengi:** genel listelerde tahsilat `+` yeşil, ödeme `−` kırmızı, veresiye satış `+`, veresiye alış `−`; cari detayında tasarımdaki gibi işaret cari bakiyesine etkidir (tahsilat `−`), renk para akışıdır (tahsilat yeşil, veresiye nötr).
- **Devir hareketi** yalnızca cari detayındaki "İşlem ekle"den girilir; düzenlerken tipi değiştirilemez.
- **HeroUI BottomSheet portalı `BusinessProvider`'ın dışında render edilir:** içine `useMoney` / `useDates` kullanan bileşen (ör. `DateField`) koyma, çöker; RN `Modal` (pageSheet) kullan (`CustomRangeSheet`, `TransactionFilterSheet`).
- **`SafeAreaView`'a (safe-area-context) `className` verme:** Uniwind onu stillemiyor (`flex-1`, zemin uygulanmıyor → Modal içinde alanlar üst üste biniyor, alttaki düğme taşıyordu). Kök düz `View` + `useSafeAreaInsets()` ile `padding`; Modal pageSheet'te üst boşluk yalnızca Android'de.
- **`ErrorScreen` sağlayıcıların dışında da render edilebilir:** HeroUI bileşeni kullanmaz (Faz 6'da Button yüzünden hata ekranı da çöküyordu).
- **victory-native eksen:** `tickValues` verince `tickCount`'u da `tickValues.length` yap, yoksa 5'e seyreltir.
- **HeroUI BottomSheet portalı RN `Modal`'ın arkasında kalır:** Modal içinden açılacak seçiciler (ör. `DateField` iOS takvimi) RN `Modal` kullanır.
- **React Compiler:** RHF `watch()` bileşeni derleyiciden çıkarır; abonelik için `subscribe` kullan. Ref'e dokunan fonksiyonları `handleSubmit`'e verilen callback'ten doğrudan çağırma (lint `react-hooks/refs`), küçük bir kancaya taşı.
- **Özet kartı ay seçicisi (kullanıcı kararı):** seçilen ayın SONUNDAKİ net bakiye / alacak / borç (`totals(asOf)`); varsayılan bu ay. Hesap kartları her zaman bugünkü bakiye.
- **Para birimi değişince dönüştürme (kullanıcı kararı):** tüm tutarlar (silinmişler dahil hareketler, hesap açılış bakiyeleri, düzenli ödemeler) değişim gününün TEK kuruyla çevrilir (`businessProfileRepo.changeCurrency`, tek transaction). Kur Frankfurter'dan (ECB, anahtarsız) gelir, elle düzeltilebilir; internet yoksa elle girilir. Kuruş yuvarlamasından çok kalemli hesaplarda ±1 kuruş fark kalabilir. Para birimi `update()` ile değiştirilemez.
- **Ücretsiz hesap sınırı:** 1 aktif kasa + 1 aktif banka (`canAddActiveAccount`); yeni hesap, aktif hesabın tür değişimi ve pasif hesabı aktife alırken.
- **HeroUI `Chip` satırda dikey ortalanmıyor;** bir `View` içine sar.
- **Düzenli ödeme tekrarı:** aylık/yıllıkta gün `startDate`'ten gelir, kısa ayda ayın son günü (31 Oca → 28 Şub → 31 Mar). Düzenlemede tarih/sıklık/aralık değişirse `startDate = nextDueDate = yeni tarih`. "Ödendi" her zaman bir dönem ilerletir (gecikmiş birden çok dönemde tekrar basılır). Zamanı geçmiş hatırlatma bildirimi kurulmaz.
- **Düzenli ödeme düğmesi eylem diliyle (kullanıcı geri bildirimi):** "Ödedim" / "Tahsil ettim" (EN "Mark paid" / "Mark received"); "Ödendi" durum gibi okunuyordu. Ödenmiş kayıtlarda ayrı satırda yeşil "Son ödeme: …" (`lastPaidDate`, hareketlerden hesaplanır).
- **Hatırlatıcı durumu:** "Tamam" → `done`; düzenlenen hatırlatıcı tekrar `pending`. Geçmiş bir zamana hatırlatıcı kurulamaz.
- **Tarih biçimi** `Intl.DateTimeFormat` (UTC) ile; date-fns kurulmadı (Faz 6 dönem hesapları da `dates.ts` UTC yardımcılarıyla yeterli oldu).
- **Rapor tanımları (Faz 6):** gelir = tahsilat, gider = ödeme (şemadaki örnek sorgular); devir rapora girmez. Gider dağılımları yalnızca ödemelerden. Hesap bakiyeleri dönem sonunda (dönem sürüyorsa bugün). Gelecek döneme gidilmez.
- **Grafik kırılımı:** yıl → aylar, ay ve hafta → günler, gün → grafik yok. Özel aralık: ≤31 gün günler, ≤183 gün haftalar, ≤3 yıl aylar, sonra yıllar. Hafta başı `en-US`'de Pazar, diğerlerinde Pazartesi (`weekStartFor`).
- **Yalnızca gelir-gider grafiği victory-native;** tür/konu/hesap dağılımları View çubuklarıyla (`BarList`): uzun adlar alta kayar, Dynamic Type ve ekran okuyucu çalışır, satıra dokunulabilir. Skia yazısı yazı boyutuyla en fazla 1,3× büyür.
- **Grafikler Premium (Faz 9):** ücretsizde özet kartları + tanıtım kartı. Grafik `chartPressConfig.pan.activateAfterLongPress` ile basılı tutunca devreye girer, sayfa kaydırması bozulmaz.

- **Excel: SheetJS Community Edition (kullanıcı kararı, Faz 7):** kalın + dondurulmuş başlık satırı Pro özelliği olduğu için yok (§10.2'den sapma); yerine başlıkta otomatik filtre ve sütun genişlikleri. Tarih hücreleri Excel seri numarası + dile göre biçim (`Date` kullanılmaz, saat dilimi kayması olmaz); tutarlar ana birimde sayı, `#,##0.00`. "Tutar" sütunu işaretsiz (yönü hareket tipi verir); Gelir = tahsilat, Gider = ödeme.
- **Ekstre Borç/Alacak (kullanıcı kararı):** işletme defteri bakışı — Borç = veresiye satış, cariye ödeme, alacak devri; Alacak = tahsilat, veresiye alış, borç devri. Bakiye işaretsiz + `(B)` / `(A)` (EN `(Dr)` / `(Cr)`); Borç ve (B) yeşil, Alacak ve (A) kırmızı. Varsayılan dönem "Tümü"; aralık başı verilince öncesi "Devreden bakiye".
- **PDF:** sistem yazı tipi (Plus Jakarta Sans gömülmedi), kâğıt her zaman açık tema tokenlarıyla. Logo data URI olarak gömülür (iOS WKWebView yerel dosya yüklemez). "Tabulo ile oluşturuldu" notu Premium'da da kalır (kullanıcı kararı, Faz 9; §10.1'den sapma). Dışa aktarma Premium.
- **PDF dönem raporu düzeni (kullanıcı isteği):** 1) kartlar: Gelir, Gider, Net, Veresiye satış, Veresiye alış; 2) Kasa ve Banka dönem neti (hesap türüne göre toplam, giriş − çıkış; pasif hesaplar dahil, `reportsRepo.cashFlowByAccountType`); 3) "Özet – Tür bazlı": Gelir türü (tahsilatlar, `incomeByType`) ve Gider türü (ödemeler) yan yana, Adet + Tutar + Toplam; 4) altında eski bölümler aynen (gelir-gider kırılımı, türe/konuya göre gider, hesap bakiyeleri). Veresiye satış/alış tür özetine girmez (gelir = tahsilat kuralı). 12 satıra kadar tablolar başlığıyla aynı sayfada tutulur.
- **PDF sayfalama (Faz 7, iOS simülatöründe ölçüldü):** iOS WebKit baskıda tablo başlığını tekrarlamıyor, satırı bölüyor, `position: fixed` notu sayfa dibine koymuyor. Bu yüzden iOS'ta belge içi script sayfalıyor ([src/pdf/paginate.ts](src/pdf/paginate.ts)): düzen genişliği 663 px, sayfa 956 px (WebKit yazdırılabilir alanı 1,25 kat CSS pikselle dizer; 531 × 770 pt). iOS'ta `@page` kuralı OLMAMALI (ölçeği küçültüyor), kenar boşluğu expo-print `margins`'ten. Android'de expo-print WebView'da JavaScript kapalı → `css` modu: Chromium başlığı tekrarlar, satırı bölmez, not `@page { @bottom-center }` ile. Mod `FormatContext.pdfPagination` (Platform.OS). Şablonlarda: `#flow` çocukları sayfalanır, `section.split-flow` satır satır bölünür (`keep` önce bütün taşınır), `.flow-title` devam sayfasında tekrarlanmaz. Android çıktısı Chrome ile denendi, cihazda denenmedi.
- **Ekstre cari kutusu (kullanıcı isteği):** solda ad, telefon, e-posta; sağda tip, vergi/kimlik, adres, il/ilçe.
- **Yedek biçimi (Faz 8):** satırlar HAM SQLite değerleriyle (snake_case, ms zaman damgası, 0/1), silinmişler dahil. Belge/logo yoksa `tabulo-yedek-YYYY-AA-GG.json` (EN `tabulo-backup-…`), varsa aynı adla `.zip` (`tabulo-backup.json` + `attachments/…`, `logo/…`; JPEG/PDF sıkıştırılmadan). Zip'ten yalnızca `isBackupFilePath`'e uyan yollar açılır. Yeni migration eklenince `BACKUP_SCHEMA_VERSION` artırılmalı (test kontrol eder) ve eski yedekler için `upgradeBackup`'a adım eklenmeli; daha yeni sürümlü yedek `backupTooNew` ile reddedilir.
- **Geri yükleme sırası:** zip önce önbellekte geçici klasöre açılır, doğrulanır, onay sorulur; DB tek transaction (yabancı anahtar sırasıyla sil/ekle, sonra `localizeSeedRecords`); ancak başarılıysa belge/logo klasörleri silinip yedektekiler taşınır, hareket taslağı silinir. MMKV'den yalnızca varsayılan hatırlatma saati yedeğe girer (`settings.defaultRemindTime`, kullanıcı isteği; isteğe bağlı alan, şema sürümü değişmedi); dil, tema, son hesap girmez.
- **Son yedek tarihi** MMKV `lastBackupDate`; paylaş ekranı kapanınca yazılır (kaydedilip kaydedilmediği bilinemez). Hatırlatma: 30 günden eskiyse veya hiç yedek yokken cari/hareket varsa. **Yedek almak Premium, geri yüklemek herkese açık** (kullanıcı kararı, Faz 9; §10.3'ten sapma): eski veriyi kurtarmak engellenmez.
- **Excel "Cariler" sayfası** tüm carileri (pasifler dahil) güncel bakiyeyle yazar; filtreler yalnızca Hareketler'e ve özete uygulanır.

## Kullanıcıdan cevap bekleyen sorular

- Mağaza anahtarları (`EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `_ANDROID_KEY`) henüz yok: sürüm derlemesinde paywall "kullanılamıyor" der. Android paywall'unda kullanım koşulları bağlantısı Apple EULA'sına gidiyor; kendi koşullar sayfası yazılmalı.
- EAS `projectId`: kullanıcı `eas init` çalıştırınca `app.config.ts` → `extra.eas.projectId`'ye eklenecek.

- Kendi kullanım koşulları (şimdilik Apple standart EULA). Gizlilik politikası yayında: https://sites.google.com/view/tabulo-gizlilik/ (veri sorumlusu Yasin Türk, iletişim lemartsoft@gmail.com); yayındaki metin `docs/privacy-policy.md`'den genişletildi, repo kopyası eşitlenecek.

## Komutlar ve yerel ortam

```bash
npx expo start --dev-client --port 8082   # 8081'i kullanıcının başka projesi (qrz-mobile) kullanıyor; ona dokunma
npx expo run:ios --no-bundler             # derle + simülatöre kur
npx tsc --noEmit && npx eslint . && npm test
npm run db:generate                       # şema değişince migration üret
```

- Simülatördeki DB: `sqlite3 "$(find "$(xcrun simctl get_app_container booted com.lemartsoft.tabulo data)" -name tabulo.db)"`

- Uygulamayı 8082'deki Metro'ya bağlamak: `xcrun simctl openurl booted "exp+tabulo://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8082"`
- Simülatöre dokunma aracı yok. Ekranlara derin bağlantıyla git (`tabulo://settings`, `tabulo://dev/form-demo`, `tabulo://contact/c1`, `tabulo://transactions`, `tabulo://transaction/new?type=collection`, `tabulo://settings/accounts`, `tabulo://settings/currency`); koyu tema için `xcrun simctl ui booted appearance dark`.
- Simülatör DB'sinde elle eklenmiş geliştirme verisi var (`c1`…`c5`, `t1`…`t4`, `demo-1`…`demo-4`, düzenli ödeme `rp-1`…`rp-4`, hatırlatıcı `rm-1`, `rm-2`).
- `ios/` ve `android/` üretilen klasörlerdir (CNG); elle düzenleme, ayarı `app.config.ts`'e yaz.
