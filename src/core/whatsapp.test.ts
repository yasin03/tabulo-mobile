import { whatsappUrl } from './whatsapp';

describe('whatsappUrl', () => {
  it('telefonu artısız yazar, mesajı kodlar', () => {
    expect(whatsappUrl('+905321234567', 'Merhaba Ayşe, bakiyeniz 1.500,00 ₺')).toBe(
      'https://wa.me/905321234567?text=Merhaba%20Ay%C5%9Fe%2C%20bakiyeniz%201.500%2C00%20%E2%82%BA',
    );
  });
});
