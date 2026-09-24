import { EventType } from '../src/api/modules/orchestration/transactions/dto/ingest-transaction.dto';
import { itemTaxInPennies } from '../src/api/modules/orchestration/taxPosition/utils/item-tax';
import { replayTaxPosition } from '../src/api/modules/orchestration/taxPosition/utils/replay-tax-position';
import {
  compareForReplay,
  StoredTaxEvent,
} from '../src/api/modules/orchestration/taxPosition/utils/tax-event';

const ingestedAt = new Date('2024-01-01T00:00:00Z');

function sale(
  id: number,
  date: string,
  items: { itemId: string; cost: number; taxRate: number }[],
  storedAt: Date = ingestedAt,
): StoredTaxEvent {
  return {
    id,
    date,
    ingestedAt: storedAt,
    payload: {
      kind: EventType.SALES,
      date,
      invoiceId: 'inv-1',
      items,
    },
  };
}

function payment(id: number, date: string, amount: number): StoredTaxEvent {
  return {
    id,
    date,
    ingestedAt,
    payload: {
      kind: EventType.TAX_PAYMENT,
      date,
      amount,
    },
  };
}

describe('itemTaxInPennies', () => {
  it('rounds 1099 at 20% (219.8) to 220', () => {
    expect(itemTaxInPennies(1099, 0.2)).toBe(220);
  });

  it('rounds half a penny up, so 1 at 50% is 1', () => {
    expect(itemTaxInPennies(1, 0.5)).toBe(1);
  });

  it('is zero when the cost is zero', () => {
    expect(itemTaxInPennies(0, 0.2)).toBe(0);
  });

  it('is zero when the rate is zero', () => {
    expect(itemTaxInPennies(1000, 0)).toBe(0);
  });
});

describe('compareForReplay', () => {
  it('orders an earlier event date first', () => {
    const january = sale(2, '2024-01-02T00:00:00Z', []);
    const first = sale(1, '2024-01-01T00:00:00Z', []);

    expect([january, first].sort(compareForReplay)).toEqual([first, january]);
  });

  it('keeps ingest order when the event dates match', () => {
    const date = '2024-02-22T17:29:39Z';
    const storedSecond = sale(2, date, [], new Date('2024-03-01T00:00:01Z'));
    const storedFirst = sale(9, date, [], new Date('2024-03-01T00:00:00Z'));

    expect([storedSecond, storedFirst].sort(compareForReplay)).toEqual([
      storedFirst,
      storedSecond,
    ]);
  });

  it('breaks a remaining tie by id', () => {
    const date = '2024-02-22T17:29:39Z';
    const higherId = sale(9, date, []);
    const lowerId = sale(2, date, []);

    expect([higherId, lowerId].sort(compareForReplay)).toEqual([
      lowerId,
      higherId,
    ]);
  });
});

describe('replayTaxPosition', () => {
  it('returns zero when there is nothing to replay', () => {
    expect(replayTaxPosition([])).toBe(0);
  });

  it('replaces only the items a later sale names', () => {
    const events = [
      sale(1, '2024-02-22T10:00:00Z', [
        { itemId: 'a', cost: 1000, taxRate: 0.2 },
        { itemId: 'b', cost: 1000, taxRate: 0.2 },
      ]),
      sale(2, '2024-02-22T12:00:00Z', [
        { itemId: 'a', cost: 500, taxRate: 0.2 },
      ]),
    ];

    expect(replayTaxPosition(events)).toBe(300);
  });

  it('subtracts the payment from the sales tax', () => {
    const events = [
      sale(1, '2024-02-22T10:00:00Z', [
        { itemId: 'item-1', cost: 1000, taxRate: 0.2 },
      ]),
      payment(2, '2024-02-22T12:00:00Z', 50),
    ];

    expect(replayTaxPosition(events)).toBe(150);
  });
});
