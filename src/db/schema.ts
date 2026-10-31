// =====================================================================
// Tabulo – Veritabanı şeması v2 (Drizzle ORM + expo-sqlite)
// =====================================================================
//
// GENEL KURALLAR
// - Tutar: kuruş cinsinden TAM SAYI. Kullanıcı 25450,65 yazar -> 2545065 saklanır.
//   Noktadan/virgülden sonra en fazla 2 basamak. Ekranda dile göre biçimlenir
//   (TR: 25.450,65 ₺ / EN: £25,450.65).
// - Tutar her zaman POZİTİF saklanır; yönünü "hareket tipi" belirler.
// - Cari bakiyesi ve kasa/banka bakiyesi SAKLANMAZ, hareketlerden hesaplanır.
// - Silinen kayıt gerçekten silinmez, "silindi_tarihi" doldurulur (geri alma için).
// - Kimlikler UUIDv7 (yedek geri yüklemede ve ileride senkronizasyonda çakışmaz).
//   React Native'de 'react-native-get-random-values' paketi gerekir.
// - Tarihler 'YYYY-AA-GG' metni olarak saklanır (saat dilimi sorunu olmaz).
// =====================================================================

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { v7 as uuidv7 } from 'uuid';

// ---------- Her tabloda ortak alanlar ----------

const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => uuidv7());

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp_ms' }) // Oluşturulma zamanı
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }) // Son güncelleme zamanı
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
  deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }), // Silindi ise silinme zamanı
};

// ---------- Seçenek listeleri ----------

export const STATUS = ['active', 'passive'] as const; // Aktif / Pasif

export const PERSON_TYPES = ['individual', 'company'] as const; // Şahıs / Şirket
export const CONTACT_ROLES = ['customer', 'supplier', 'both'] as const; // Müşteri / Tedarikçi / İkisi

export const ACCOUNT_TYPES = ['cash', 'bank'] as const; // Kasa / Banka

// Hareket tipi
export const MOVEMENT_TYPES = [
  'collection', // Tahsilat        -> kasaya/bankaya para GİRER
  'payment', // Ödeme              -> kasadan/bankadan para ÇIKAR
  'credit_sale', // Veresiye satış -> para hareketi yok, cari BİZE borçlanır
  'credit_purchase', // Veresiye alış -> para hareketi yok, BİZ cariye borçlanırız
  'opening', // Devir              -> carinin eski bakiyesi (açılış)
] as const;

export const DIRECTIONS = ['income', 'expense'] as const; // Gelir / Gider
export const OPENING_DIRECTIONS = ['receivable', 'payable'] as const; // Devir: Alacağımız / Borcumuz
export const FREQUENCIES = ['weekly', 'monthly', 'yearly'] as const; // Haftalık / Aylık / Yıllık
export const REMINDER_STATUSES = ['pending', 'done', 'dismissed'] as const; // Bekliyor / Tamam / Vazgeçildi

// =====================================================================
// 1) İŞLETME PROFİLİ (tek satır) – PDF ekstre başlığında kullanılır
// =====================================================================

export const businessProfile = sqliteTable('business_profile', {
  id: text('id').primaryKey().default('default'),
  name: text('name').notNull().default(''), // İşletme adı / Unvan
  phone: text('phone'), // Telefon
  email: text('email'), // E-posta
  city: text('city'), // İl
  district: text('district'), // İlçe
  address: text('address'), // Adres
  taxNumber: text('tax_number'), // Vergi no
  taxOffice: text('tax_office'), // Vergi dairesi
  logoUri: text('logo_uri'), // Logo dosyası
  currency: text('currency').notNull().default('TRY'), // Para birimi: TRY, GBP, USD
  ...timestamps,
});

// =====================================================================
// 2) CARİLER
// =====================================================================

export const contacts = sqliteTable(
  'contacts',
  {
    id: id(),
    personType: text('person_type', { enum: PERSON_TYPES }).notNull().default('individual'), // Şahıs / Şirket
    role: text('role', { enum: CONTACT_ROLES }).notNull().default('customer'), // Müşteri / Tedarikçi / İkisi
    name: text('name').notNull(), // Şahıs: Ad Soyad — Şirket: Unvan

    nationalId: text('national_id'), // TC Kimlik No (sadece şahıs, 11 hane)
    taxNumber: text('tax_number'), // Vergi No (sadece şirket, 10 hane)
    taxOffice: text('tax_office'), // Vergi Dairesi (sadece şirket)

    city: text('city'), // İl
    district: text('district'), // İlçe
    address: text('address'), // Açık adres
    phone: text('phone'), // Telefon (+905320000000 biçiminde; WhatsApp için)
    email: text('email'), // E-posta
    note: text('note'), // Not

    status: text('status', { enum: STATUS }).notNull().default('active'), // Durum: Aktif / Pasif
    ...timestamps,
  },
  (t) => [index('contacts_name_idx').on(t.name), index('contacts_status_idx').on(t.status)],
);

// =====================================================================
// 3) HESAPLAR (Kasa / Banka)
// Kullanıcı birden fazla hesap açabilir: "Kasa", "Ziraat Bankası", "Garanti POS"...
// =====================================================================

export const accounts = sqliteTable('accounts', {
  id: id(),
  name: text('name').notNull(), // Hesap adı: "Kasa", "Ziraat Bankası"
  type: text('type', { enum: ACCOUNT_TYPES }).notNull(), // Hesap tipi: Kasa / Banka
  bankName: text('bank_name'), // Banka adı (banka ise)
  iban: text('iban'), // IBAN (banka ise, ekstrede gösterilebilir)
  openingBalanceMinor: integer('opening_balance_minor').notNull().default(0), // Açılış bakiyesi (kuruş)
  currency: text('currency').notNull().default('TRY'),
  status: text('status', { enum: STATUS }).notNull().default('active'),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps,
});

// =====================================================================
// 4) İŞLEM TÜRLERİ (Faiz geliri, Kira geliri, Satış, Yakıt, Maaş...)
// Hazır liste ile gelir, kullanıcı ekleyip düzenleyebilir.
// =====================================================================

export const transactionTypes = sqliteTable('transaction_types', {
  id: id(),
  name: text('name').notNull(), // "Faiz Geliri"
  direction: text('direction', { enum: DIRECTIONS }).notNull(), // Gelir / Gider
  icon: text('icon'),
  color: text('color'),
  isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false), // Hazır gelen mi?
  status: text('status', { enum: STATUS }).notNull().default('active'),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps,
});

// =====================================================================
// 5) İŞLEM KONULARI (Araç, Genel, Ofis, Diğer...)
// "Bu para neyle ilgili?" sorusu. Raporda "Araç için ne harcadım?" görülür.
// =====================================================================

export const subjects = sqliteTable('subjects', {
  id: id(),
  name: text('name').notNull(), // "Araç"
  isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
  status: text('status', { enum: STATUS }).notNull().default('active'),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps,
});

// =====================================================================
// 6) İŞLEMLER (Hareketler) – uygulamanın kalbi
// =====================================================================

export const transactions = sqliteTable(
  'transactions',
  {
    id: id(),
    movementType: text('movement_type', { enum: MOVEMENT_TYPES }).notNull(), // Hareket tipi
    accountId: text('account_id').references(() => accounts.id), // Hesap (Kasa/Banka) – tahsilat/ödemede zorunlu
    transactionTypeId: text('transaction_type_id').references(() => transactionTypes.id), // İşlem türü
    subjectId: text('subject_id').references(() => subjects.id), // İşlem konusu
    contactId: text('contact_id').references(() => contacts.id), // Cari hesap – veresiye/devirde zorunlu

    date: text('date').notNull(), // Tarih 'YYYY-AA-GG'
    amountMinor: integer('amount_minor').notNull(), // Tutar (kuruş, her zaman > 0)
    currency: text('currency').notNull().default('TRY'),
    description: text('description'), // Açıklama

    // --- Benim eklediğim alanlar ---
    documentNo: text('document_no'), // Belge no (fatura/fiş/makbuz numarası)
    dueDate: text('due_date'), // Vade tarihi (veresiye satış/alışta: ne zaman ödenecek?)
    openingDirection: text('opening_direction', { enum: OPENING_DIRECTIONS }), // Sadece devirde: alacak mı borç mu?
    recurringPaymentId: text('recurring_payment_id').references(() => recurringPayments.id), // Düzenli ödemeden geldiyse
    isCash: integer('is_cash', { mode: 'boolean' }).notNull().default(false), // Peşin: cari bakiyesini etkilemez (yalnız tahsilat/ödeme + cari)
    ...timestamps,
  },
  (t) => [
    index('tx_contact_date_idx').on(t.contactId, t.date),
    index('tx_account_date_idx').on(t.accountId, t.date),
    index('tx_date_idx').on(t.date),
    index('tx_type_idx').on(t.transactionTypeId),
    index('tx_subject_idx').on(t.subjectId),
    index('tx_due_idx').on(t.dueDate),
  ],
);

// =====================================================================
// 7) BELGELER – bir işleme birden fazla fiş/fatura fotoğrafı veya PDF eklenebilir
// =====================================================================

export const attachments = sqliteTable(
  'attachments',
  {
    id: id(),
    transactionId: text('transaction_id')
      .notNull()
      .references(() => transactions.id),
    fileUri: text('file_uri').notNull(), // Cihazdaki dosya yolu
    fileName: text('file_name'),
    mimeType: text('mime_type'), // image/jpeg, application/pdf
    sizeBytes: integer('size_bytes'),
    ...timestamps,
  },
  (t) => [index('attachments_tx_idx').on(t.transactionId)],
);

// =====================================================================
// 8) DÜZENLİ ÖDEMELER (Kira, SGK, Netflix, Vergi...)
// "Ödendi" denince bir işlem oluşturulur, sonraki tarih ileri alınır.
// =====================================================================

export const recurringPayments = sqliteTable(
  'recurring_payments',
  {
    id: id(),
    title: text('title').notNull(), // "Dükkan kirası"
    movementType: text('movement_type', { enum: ['payment', 'collection'] })
      .notNull()
      .default('payment'), // Ödeme / Tahsilat
    amountMinor: integer('amount_minor').notNull(),
    currency: text('currency').notNull().default('TRY'),
    accountId: text('account_id').references(() => accounts.id), // Varsayılan hesap
    transactionTypeId: text('transaction_type_id').references(() => transactionTypes.id),
    subjectId: text('subject_id').references(() => subjects.id),
    contactId: text('contact_id').references(() => contacts.id), // Ör. ev sahibi

    frequency: text('frequency', { enum: FREQUENCIES }).notNull().default('monthly'), // Sıklık
    interval: integer('interval').notNull().default(1), // Her 1 ayda, her 3 ayda...
    startDate: text('start_date').notNull(), // Başlangıç
    endDate: text('end_date'), // Bitiş (boşsa süresiz)
    nextDueDate: text('next_due_date').notNull(), // Sonraki ödeme tarihi

    remindDaysBefore: integer('remind_days_before').notNull().default(1), // Kaç gün önce hatırlat
    remindTime: text('remind_time').notNull().default('09:00'), // Saat
    notificationId: text('notification_id'), // Bildirim kimliği (iptal/yeniden kurmak için)
    status: text('status', { enum: STATUS }).notNull().default('active'),
    ...timestamps,
  },
  (t) => [index('recurring_next_idx').on(t.status, t.nextDueDate)],
);

// =====================================================================
// 9) TAHSİLAT HATIRLATICILARI – "Ahmet Bey'den 25 Ekim'de tahsil et"
// =====================================================================

export const reminders = sqliteTable(
  'reminders',
  {
    id: id(),
    contactId: text('contact_id')
      .notNull()
      .references(() => contacts.id),
    transactionId: text('transaction_id').references(() => transactions.id), // İlgili veresiye satış
    remindDate: text('remind_date').notNull(),
    remindTime: text('remind_time').notNull().default('09:00'),
    note: text('note'),
    status: text('status', { enum: REMINDER_STATUSES }).notNull().default('pending'),
    notificationId: text('notification_id'),
    ...timestamps,
  },
  (t) => [index('reminders_status_date_idx').on(t.status, t.remindDate)],
);

// =====================================================================
// HAREKET TİPİNİN ETKİSİ (tek doğruluk kaynağı)
// contact: cari bakiyesine etkisi  (+ = cari bize borçlu / - = biz cariye borçluyuz)
// account: kasa/banka bakiyesine etkisi (+ para girdi / - para çıktı)
// =====================================================================

export const MOVEMENT_EFFECT: Record<
  (typeof MOVEMENT_TYPES)[number],
  { contact: -1 | 0 | 1; account: -1 | 0 | 1 }
> = {
  collection: { contact: -1, account: 1 }, // Tahsilat: cari borcu azalır, kasa artar (peşinse cariye etkisi yok)
  payment: { contact: 1, account: -1 }, // Ödeme: bizim borcumuz azalır, kasa azalır
  credit_sale: { contact: 1, account: 0 }, // Veresiye satış: cari bize borçlanır
  credit_purchase: { contact: -1, account: 0 }, // Veresiye alış: biz borçlanırız
  opening: { contact: 1, account: 0 }, // Devir: yönü openingDirection belirler (payable ise -1)
};

// =====================================================================
// DOĞRULAMA KURALLARI (form katmanında zod ile uygulanacak)
// - Tahsilat / Ödeme      : hesap ZORUNLU, cari İSTEĞE BAĞLI (faiz geliri gibi carisiz olabilir)
// - Veresiye satış / alış : cari ZORUNLU, hesap BOŞ
// - Devir                 : cari ZORUNLU, devir yönü ZORUNLU, hesap BOŞ
// - Tutar                 : > 0, en fazla 2 ondalık basamak
// - Şahıs                 : TC Kimlik No 11 hane + resmi kontrol algoritması (boş bırakılabilir)
// - Şirket                : Vergi No 10 hane (boş bırakılabilir)
// - Pasif cari            : listelerde varsayılan gizli, yeni işlemde seçilemez, geçmişi durur
// =====================================================================

// =====================================================================
// İLK KURULUMDA GELEN HAZIR VERİLER
// =====================================================================

export const SEED_ACCOUNTS = [
  { name: 'Kasa', type: 'cash' as const },
  { name: 'Banka', type: 'bank' as const },
];

export const SEED_TRANSACTION_TYPES = [
  // Gelir
  { name: 'Satış', direction: 'income' as const },
  { name: 'Hizmet Bedeli', direction: 'income' as const },
  { name: 'Cari Tahsilatı', direction: 'income' as const },
  { name: 'Kira Geliri', direction: 'income' as const },
  { name: 'Faiz Geliri', direction: 'income' as const },
  { name: 'Diğer Gelir', direction: 'income' as const },
  // Gider
  { name: 'Doğalgaz', direction: 'expense' as const },
  { name: 'Elektrik', direction: 'expense' as const },
  { name: 'Kargo', direction: 'expense' as const },
  { name: 'Kira', direction: 'expense' as const },
  { name: 'Ofis Gideri', direction: 'expense' as const },
  { name: 'Personel', direction: 'expense' as const },
  { name: 'SGK', direction: 'expense' as const },
  { name: 'Su', direction: 'expense' as const },
  { name: 'Vergi', direction: 'expense' as const },
  { name: 'Yakıt', direction: 'expense' as const },
  { name: 'Yemek', direction: 'expense' as const },
  { name: 'Diğer', direction: 'expense' as const },
];

export const SEED_SUBJECTS = ['Genel', 'Araç', 'Ofis', 'Diğer'];

// =====================================================================
// ÖRNEK SORGULAR
// =====================================================================
//
// Cari bakiyesi (+ ise cari bize borçlu; peşin tahsilat/ödeme sayılmaz):
// SELECT COALESCE(SUM(CASE WHEN is_cash = 1 THEN 0 ELSE CASE movement_type
//     WHEN 'credit_sale'     THEN  amount_minor
//     WHEN 'payment'         THEN  amount_minor
//     WHEN 'collection'      THEN -amount_minor
//     WHEN 'credit_purchase' THEN -amount_minor
//     WHEN 'opening'         THEN CASE opening_direction WHEN 'receivable' THEN amount_minor ELSE -amount_minor END
//   END END), 0) AS bakiye
// FROM transactions WHERE contact_id = ? AND deleted_at IS NULL;
//
// Kasa/banka bakiyesi:
// SELECT a.opening_balance_minor + COALESCE(SUM(CASE t.movement_type
//     WHEN 'collection' THEN t.amount_minor WHEN 'payment' THEN -t.amount_minor ELSE 0 END), 0)
// FROM accounts a LEFT JOIN transactions t ON t.account_id = a.id AND t.deleted_at IS NULL
// WHERE a.id = ? GROUP BY a.id;
//
// Aylık gelir-gider raporu (gün: '%Y-%m-%d', hafta: '%Y-%W', yıl: '%Y'):
// SELECT strftime('%Y-%m', date) AS donem,
//   SUM(CASE WHEN movement_type = 'collection' THEN amount_minor ELSE 0 END) AS gelir,
//   SUM(CASE WHEN movement_type = 'payment'    THEN amount_minor ELSE 0 END) AS gider
// FROM transactions WHERE deleted_at IS NULL AND date BETWEEN ? AND ?
// GROUP BY donem ORDER BY donem;
//
// Konuya göre gider ("Araç için ne harcadım?"):
// SELECT s.name, SUM(t.amount_minor) FROM transactions t JOIN subjects s ON s.id = t.subject_id
// WHERE t.movement_type = 'payment' AND t.deleted_at IS NULL AND t.date BETWEEN ? AND ?
// GROUP BY s.id;
