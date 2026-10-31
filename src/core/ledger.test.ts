import { MOVEMENT_EFFECT, MOVEMENT_TYPES } from '@/db/schema';

import {
  accountBalance,
  accountEffect,
  balanceState,
  contactBalance,
  contactEffect,
  contactViewDisplay,
  defaultIsCash,
  effectiveIsCash,
  generalDisplay,
  MOVEMENT_RULES,
  nearestDue,
  openItems,
  validateMovement,
  withRunningBalance,
  type DueMovement,
  type LedgerMovement,
  type MovementFields,
  type MovementType,
} from './ledger';

describe('MOVEMENT_EFFECT (PROMPT 5.1 tablosu)', () => {
  it('tablodaki etkilerle birebir aynı', () => {
    expect(MOVEMENT_EFFECT).toEqual({
      collection: { contact: -1, account: 1 },
      payment: { contact: 1, account: -1 },
      credit_sale: { contact: 1, account: 0 },
      credit_purchase: { contact: -1, account: 0 },
      opening: { contact: 1, account: 0 },
    });
  });

  it('her hareket tipinin bir kuralı var', () => {
    expect(Object.keys(MOVEMENT_RULES).sort()).toEqual([...MOVEMENT_TYPES].sort());
  });
});

describe('contactEffect / accountEffect', () => {
  it('Tahsilat: kasa +, cari borcu azalır', () => {
    expect(accountEffect({ movementType: 'collection' })).toBe(1);
    expect(contactEffect({ movementType: 'collection' })).toBe(-1);
  });

  it('Ödeme: kasa −, bizim borcumuz azalır', () => {
    expect(accountEffect({ movementType: 'payment' })).toBe(-1);
    expect(contactEffect({ movementType: 'payment' })).toBe(1);
  });

  it('Veresiye satış / alış kasayı etkilemez', () => {
    expect(accountEffect({ movementType: 'credit_sale' })).toBe(0);
    expect(contactEffect({ movementType: 'credit_sale' })).toBe(1);
    expect(accountEffect({ movementType: 'credit_purchase' })).toBe(0);
    expect(contactEffect({ movementType: 'credit_purchase' })).toBe(-1);
  });

  it('Devir: yönü openingDirection belirler', () => {
    expect(contactEffect({ movementType: 'opening', openingDirection: 'receivable' })).toBe(1);
    expect(contactEffect({ movementType: 'opening', openingDirection: 'payable' })).toBe(-1);
    expect(accountEffect({ movementType: 'opening' })).toBe(0);
  });
});

describe('peşin tahsilat / ödeme', () => {
  it('cari bakiyesini etkilemez, kasayı etkiler', () => {
    expect(contactEffect({ movementType: 'collection', isCash: true })).toBe(0);
    expect(contactEffect({ movementType: 'payment', isCash: true })).toBe(0);
    expect(accountEffect({ movementType: 'collection' })).toBe(1);
    expect(
      contactBalance([
        { movementType: 'collection', amountMinor: 75000, isCash: true },
        { movementType: 'credit_sale', amountMinor: 1000 },
      ]),
    ).toBe(1000);
  });

  it('yalnız tahsilat/ödemede ve cari seçiliyken geçerli', () => {
    expect(effectiveIsCash({ movementType: 'collection', contactId: 'c1', isCash: true })).toBe(
      true,
    );
    expect(effectiveIsCash({ movementType: 'collection', contactId: null, isCash: true })).toBe(
      false,
    );
    expect(effectiveIsCash({ movementType: 'credit_sale', contactId: 'c1', isCash: true })).toBe(
      false,
    );
  });

  it('varsayılan: açık borç/alacak varsa kapatır, yoksa peşin', () => {
    expect(defaultIsCash('collection', 0)).toBe(true);
    expect(defaultIsCash('collection', -500)).toBe(true);
    expect(defaultIsCash('collection', 500)).toBe(false);
    expect(defaultIsCash('payment', 0)).toBe(true);
    expect(defaultIsCash('payment', 500)).toBe(true);
    expect(defaultIsCash('payment', -500)).toBe(false);
    expect(defaultIsCash('credit_sale', 0)).toBe(false);
  });

  it('cari ekranında para akışıyla gösterilir, FIFO kalemi açmaz', () => {
    expect(contactViewDisplay({ movementType: 'collection', isCash: true })).toEqual({
      sign: 1,
      tone: 'positive',
    });
    expect(contactViewDisplay({ movementType: 'payment', isCash: true })).toEqual({
      sign: -1,
      tone: 'negative',
    });
    expect(
      openItems([
        { movementType: 'credit_sale', amountMinor: 3000, dueDate: '2026-10-10' },
        { movementType: 'collection', amountMinor: 3000, isCash: true },
      ]),
    ).toEqual([{ side: 'receivable', remainingMinor: 3000, dueDate: '2026-10-10' }]);
  });
});

describe('contactBalance', () => {
  it('boş liste sıfır', () => {
    expect(contactBalance([])).toBe(0);
  });

  it('müşteri senaryosu: devir + veresiye satış − tahsilat', () => {
    const movements: LedgerMovement[] = [
      { movementType: 'opening', openingDirection: 'receivable', amountMinor: 100000 },
      { movementType: 'credit_sale', amountMinor: 450000 },
      { movementType: 'collection', amountMinor: 300000 },
    ];
    expect(contactBalance(movements)).toBe(250000); // Size borçlu ₺2.500
  });

  it('tedarikçi senaryosu: veresiye alış − ödeme', () => {
    const movements: LedgerMovement[] = [
      { movementType: 'opening', openingDirection: 'payable', amountMinor: 20000 },
      { movementType: 'credit_purchase', amountMinor: 200000 },
      { movementType: 'payment', amountMinor: 100000 },
    ];
    expect(contactBalance(movements)).toBe(-120000); // Borcunuz ₺1.200
  });
});

describe('accountBalance', () => {
  it('açılış + tahsilat − ödeme; veresiye ve devir etkilemez', () => {
    const movements: LedgerMovement[] = [
      { movementType: 'collection', amountMinor: 50000 },
      { movementType: 'payment', amountMinor: 20000 },
      { movementType: 'credit_sale', amountMinor: 999999 },
      { movementType: 'opening', openingDirection: 'receivable', amountMinor: 999999 },
    ];
    expect(accountBalance(10000, movements)).toBe(40000);
  });
});

describe('withRunningBalance', () => {
  it('her satıra o ana kadarki bakiyeyi ekler', () => {
    const rows = withRunningBalance([
      { id: 'a', movementType: 'credit_sale' as const, amountMinor: 1000 },
      { id: 'b', movementType: 'collection' as const, amountMinor: 400 },
      { id: 'c', movementType: 'payment' as const, amountMinor: 100 },
    ]);
    expect(rows.map((r) => [r.id, r.runningBalanceMinor])).toEqual([
      ['a', 1000],
      ['b', 600],
      ['c', 700],
    ]);
  });

  it('başlangıç bakiyesinden devam edebilir (devreden bakiye)', () => {
    const rows = withRunningBalance([{ movementType: 'collection', amountMinor: 500 }], 2000);
    expect(rows[0]?.runningBalanceMinor).toBe(1500);
  });
});

describe('balanceState', () => {
  it('Size borçlu / Borcunuz / Hesap kapalı', () => {
    expect(balanceState(1)).toBe('receivable');
    expect(balanceState(-1)).toBe('payable');
    expect(balanceState(0)).toBe('settled');
  });
});

describe('validateMovement', () => {
  const base = { amountMinor: 1000, date: '2026-10-19' };

  it('geçerli örnekler', () => {
    const valid: MovementFields[] = [
      { ...base, movementType: 'collection', accountId: 'acc' },
      { ...base, movementType: 'collection', accountId: 'acc', contactId: 'c' },
      { ...base, movementType: 'payment', accountId: 'acc', transactionTypeId: 'tt' },
      { ...base, movementType: 'credit_sale', contactId: 'c', dueDate: '2026-11-01' },
      { ...base, movementType: 'credit_purchase', contactId: 'c' },
      { ...base, movementType: 'opening', contactId: 'c', openingDirection: 'payable' },
    ];
    for (const m of valid) expect(validateMovement(m)).toEqual([]);
  });

  it('Tahsilat/Ödeme: hesap zorunlu, cari isteğe bağlı', () => {
    expect(validateMovement({ ...base, movementType: 'payment' })).toEqual(['accountRequired']);
  });

  it('Veresiye: cari zorunlu, hesap boş', () => {
    expect(validateMovement({ ...base, movementType: 'credit_sale', accountId: 'acc' })).toEqual([
      'accountNotAllowed',
      'contactRequired',
    ]);
  });

  it('Devir: cari ve devir yönü zorunlu, işlem türü ve vade yok', () => {
    expect(validateMovement({ ...base, movementType: 'opening', contactId: 'c' })).toEqual([
      'openingDirectionRequired',
    ]);
    expect(
      validateMovement({
        ...base,
        movementType: 'opening',
        contactId: 'c',
        openingDirection: 'receivable',
        transactionTypeId: 'tt',
        dueDate: '2026-11-01',
      }),
    ).toEqual(['dueDateNotAllowed', 'transactionTypeNotAllowed']);
  });

  it('devir yönü yalnızca devirde', () => {
    expect(
      validateMovement({
        ...base,
        movementType: 'collection',
        accountId: 'acc',
        openingDirection: 'receivable',
      }),
    ).toEqual(['openingDirectionNotAllowed']);
  });

  it('vade yalnızca veresiyede', () => {
    expect(
      validateMovement({
        ...base,
        movementType: 'collection',
        accountId: 'a',
        dueDate: '2026-11-01',
      }),
    ).toEqual(['dueDateNotAllowed']);
    expect(
      validateMovement({
        ...base,
        movementType: 'credit_sale',
        contactId: 'c',
        dueDate: '01.11.2026',
      }),
    ).toEqual(['invalidDueDate']);
  });

  it('tutar > 0 ve tam sayı (kuruş)', () => {
    for (const amountMinor of [0, -100, 10.5, Number.NaN]) {
      expect(
        validateMovement({ ...base, amountMinor, movementType: 'collection', accountId: 'a' }),
      ).toEqual(['amountNotPositive']);
    }
  });

  it('tarih YYYY-AA-GG', () => {
    expect(
      validateMovement({ ...base, date: '2026-02-30', movementType: 'collection', accountId: 'a' }),
    ).toEqual(['invalidDate']);
  });
});

describe('generalDisplay / contactViewDisplay', () => {
  it('genel listede tahsilat/ödeme para akışı, veresiye cari etkisi', () => {
    expect(generalDisplay({ movementType: 'collection' })).toEqual({ sign: 1, tone: 'positive' });
    expect(generalDisplay({ movementType: 'payment' })).toEqual({ sign: -1, tone: 'negative' });
    expect(generalDisplay({ movementType: 'credit_sale' })).toEqual({ sign: 1, tone: 'positive' });
    expect(generalDisplay({ movementType: 'credit_purchase' })).toEqual({
      sign: -1,
      tone: 'negative',
    });
    expect(generalDisplay({ movementType: 'opening', openingDirection: 'payable' })).toEqual({
      sign: -1,
      tone: 'negative',
    });
  });

  it('cari ekranında işaret cari etkisi, renk para akışı (client-detail.html)', () => {
    expect(contactViewDisplay({ movementType: 'collection' })).toEqual({
      sign: -1,
      tone: 'positive',
    });
    expect(contactViewDisplay({ movementType: 'payment' })).toEqual({ sign: 1, tone: 'negative' });
    expect(contactViewDisplay({ movementType: 'credit_sale' })).toEqual({
      sign: 1,
      tone: 'neutral',
    });
    expect(contactViewDisplay({ movementType: 'opening', openingDirection: 'receivable' })).toEqual(
      { sign: 1, tone: 'neutral' },
    );
  });
});

describe('openItems / nearestDue (FIFO)', () => {
  const sale = (amountMinor: number, dueDate: string | null = null): DueMovement => ({
    movementType: 'credit_sale',
    amountMinor,
    dueDate,
  });
  const collection = (amountMinor: number): DueMovement => ({
    movementType: 'collection',
    amountMinor,
  });
  const purchase = (amountMinor: number, dueDate: string | null = null): DueMovement => ({
    movementType: 'credit_purchase',
    amountMinor,
    dueDate,
  });

  it('tahsilat en eski satıştan başlayarak kapatır', () => {
    const movements = [sale(3000, '2026-10-10'), sale(3000, '2026-10-25'), collection(4000)];
    expect(openItems(movements)).toEqual([
      { side: 'receivable', remainingMinor: 2000, dueDate: '2026-10-25' },
    ]);
    expect(nearestDue(movements)).toEqual({
      dueDate: '2026-10-25',
      side: 'receivable',
      remainingMinor: 2000,
    });
  });

  it('tamamen kapanan satışın vadesi gösterilmez', () => {
    expect(nearestDue([sale(3000, '2026-10-10'), collection(3000)])).toBeNull();
  });

  it('vadesi geçmiş açık kalem en acil olandır', () => {
    const movements = [sale(1000, '2026-09-01'), sale(1000, '2026-12-01'), sale(1000, null)];
    expect(nearestDue(movements)?.dueDate).toBe('2026-09-01');
  });

  it('kalemlerin toplamı bakiyeye eşittir (rastgele)', () => {
    const types: MovementType[] = ['collection', 'payment', 'credit_sale', 'credit_purchase'];
    for (let run = 0; run < 200; run++) {
      const movements: DueMovement[] = Array.from({ length: 1 + (run % 15) }, (_, i) => ({
        movementType: types[(run * 7 + i * 3) % types.length]!,
        amountMinor: 1 + ((run * 131 + i * 977) % 50_000),
        dueDate: i % 2 ? '2026-11-01' : null,
      }));
      const items = openItems(movements);
      const sum = items.reduce(
        (acc, it) => acc + (it.side === 'receivable' ? it.remainingMinor : -it.remainingMinor),
        0,
      );
      expect(sum).toBe(contactBalance(movements));
      // Açık kalemler hep tek taraftadır.
      expect(new Set(items.map((it) => it.side)).size).toBeLessThanOrEqual(1);
      expect(items.every((it) => it.remainingMinor > 0)).toBe(true);
    }
  });

  it('bizim borcumuz tarafında da çalışır; devir vadesiz açılır', () => {
    const movements: DueMovement[] = [
      { movementType: 'opening', openingDirection: 'payable', amountMinor: 500 },
      purchase(2000, '2026-11-15'),
      { movementType: 'payment', amountMinor: 1000 },
    ];
    expect(openItems(movements)).toEqual([
      { side: 'payable', remainingMinor: 1500, dueDate: '2026-11-15' },
    ]);
  });
});
