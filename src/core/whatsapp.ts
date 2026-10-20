// WhatsApp hatırlatma mesajı bağlantısı (6.7). Mesaj metni çeviri dosyasındadır.

/** `https://wa.me/<telefon>?text=<mesaj>`; telefon E.164 (`+905320000000`), artısız yazılır. */
export function whatsappUrl(phoneE164: string, message: string): string {
  const digits = phoneE164.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
