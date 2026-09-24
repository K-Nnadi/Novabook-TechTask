import { EventType } from '../src/api/modules/orchestration/transactions/dto/ingest-transaction.dto';
import {
  InMemorySaleAmendmentService,
  openInMemoryLedger,
} from './in-memory-ledger';
import { TaxPositionService } from '../src/api/modules/orchestration/taxPosition/taxPosition.service';
import { TransactionsService } from '../src/api/modules/orchestration/transactions/transactions.service';

describe('Tax position', () => {
  let transactions: TransactionsService;
  let amendments: InMemorySaleAmendmentService;
  let taxPosition: TaxPositionService;

  beforeEach(() => {
    const ledger = openInMemoryLedger();
    transactions = ledger.transactions;
    amendments = ledger.amendments;
    taxPosition = ledger.taxPosition;
  });

  async function ingestSale(
    date: string,
    invoiceId: string,
    items: { itemId: string; cost: number; taxRate: number }[],
  ): Promise<void> {
    await transactions.ingest({
      eventType: EventType.SALES,
      date,
      invoiceId,
      items,
    });
  }

  async function ingestTaxPayment(date: string, amount: number): Promise<void> {
    await transactions.ingest({
      eventType: EventType.TAX_PAYMENT,
      date,
      amount,
    });
  }

  async function positionAt(date: string): Promise<number> {
    return (await taxPosition.getTaxPosition(date)).taxPosition;
  }

  describe('an empty ledger', () => {
    it('is zero, and echoes the date that was asked for', async () => {
      const date = '2024-02-22T17:29:39Z';

      await expect(taxPosition.getTaxPosition(date)).resolves.toEqual({
        date,
        taxPosition: 0,
      });
    });
  });

  describe('a sale', () => {
    it('owes the item cost times its tax rate, rounded to the nearest penny', async () => {
      const date = '2024-02-22T17:29:39Z';
      await ingestSale(date, 'inv-1', [
        { itemId: 'item-1', cost: 1099, taxRate: 0.2 },
      ]);

      await expect(positionAt(date)).resolves.toBe(220);
    });
  });

  describe('a tax payment', () => {
    it('reduces the position by the amount paid', async () => {
      const date = '2024-02-22T17:29:39Z';
      await ingestTaxPayment(date, 100);

      await expect(positionAt(date)).resolves.toBe(-100);
    });

    it('is the sales tax minus the payment', async () => {
      await ingestSale('2024-02-22T10:00:00Z', 'inv-1', [
        { itemId: 'item-1', cost: 1000, taxRate: 0.2 },
      ]);
      await ingestTaxPayment('2024-02-22T12:00:00Z', 151);

      await expect(positionAt('2024-02-22T17:29:39Z')).resolves.toBe(49);
    });
  });

  describe('the query date', () => {
    it('includes an event that happens at that exact instant', async () => {
      const date = '2024-02-22T17:29:39Z';
      await ingestSale(date, 'inv-1', [
        { itemId: 'item-1', cost: 1000, taxRate: 0.2 },
      ]);

      await expect(positionAt(date)).resolves.toBe(200);
    });

    it('excludes an event that happens later', async () => {
      await ingestSale('2024-02-22T18:00:00Z', 'inv-1', [
        { itemId: 'item-1', cost: 1000, taxRate: 0.2 },
      ]);

      await expect(positionAt('2024-02-22T17:29:39Z')).resolves.toBe(0);
    });

    it('keeps earlier years; there is no financial-year reset', async () => {
      await ingestSale('2023-01-01T00:00:00Z', 'inv-old', [
        { itemId: 'item-1', cost: 1000, taxRate: 0.2 },
      ]);
      await ingestSale('2025-01-01T00:00:00Z', 'inv-new', [
        { itemId: 'item-2', cost: 1000, taxRate: 0.2 },
      ]);

      await expect(positionAt('2025-06-01T00:00:00Z')).resolves.toBe(400);
    });

    it('ignores a future-dated sale until the query reaches that date', async () => {
      await ingestSale('2030-01-01T00:00:00Z', 'inv-1', [
        { itemId: 'item-1', cost: 1000, taxRate: 0.2 },
      ]);

      await expect(positionAt('2024-01-01T00:00:00Z')).resolves.toBe(0);
      await expect(positionAt('2030-01-01T00:00:00Z')).resolves.toBe(200);
    });
  });

  describe('an amendment', () => {
    it('counts before the sale has been ingested, then yields to a later sale of the same item', async () => {
      await amendments.create({
        date: '2024-02-21T00:00:00Z',
        invoiceId: 'inv-1',
        itemId: 'item-1',
        cost: 500,
        taxRate: 0.2,
      });

      await expect(positionAt('2024-02-21T12:00:00Z')).resolves.toBe(100);

      await ingestSale('2024-02-22T00:00:00Z', 'inv-1', [
        { itemId: 'item-1', cost: 1000, taxRate: 0.2 },
      ]);

      await expect(positionAt('2024-02-22T00:00:00Z')).resolves.toBe(200);
    });

    it('replaces the item from the amendment date, and not before', async () => {
      await ingestSale('2024-02-22T10:00:00Z', 'inv-1', [
        { itemId: 'item-1', cost: 1000, taxRate: 0.2 },
      ]);
      await amendments.create({
        date: '2024-02-22T12:00:00Z',
        invoiceId: 'inv-1',
        itemId: 'item-1',
        cost: 798,
        taxRate: 0.15,
      });

      await expect(positionAt('2024-02-22T11:00:00Z')).resolves.toBe(200);
      await expect(positionAt('2024-02-22T12:00:00Z')).resolves.toBe(120);
    });

    it('uses the latest amendment on or before the query date', async () => {
      await amendments.create({
        date: '2024-01-01T00:00:00Z',
        invoiceId: 'inv-1',
        itemId: 'item-1',
        cost: 1000,
        taxRate: 0.2,
      });
      await amendments.create({
        date: '2024-06-01T00:00:00Z',
        invoiceId: 'inv-1',
        itemId: 'item-1',
        cost: 500,
        taxRate: 0.1,
      });

      await expect(positionAt('2024-03-01T00:00:00Z')).resolves.toBe(200);
      await expect(positionAt('2024-12-01T00:00:00Z')).resolves.toBe(50);
    });
  });

  describe('a later sale that lists only some of the invoice items', () => {
    it('replaces those items and leaves the others in place', async () => {
      await ingestSale('2024-02-22T10:00:00Z', 'inv-1', [
        { itemId: 'a', cost: 1000, taxRate: 0.2 },
        { itemId: 'b', cost: 1000, taxRate: 0.2 },
      ]);
      await ingestSale('2024-02-22T12:00:00Z', 'inv-1', [
        { itemId: 'a', cost: 500, taxRate: 0.2 },
      ]);

      await expect(positionAt('2024-02-22T12:00:00Z')).resolves.toBe(300);
    });
  });

  describe('events that share a timestamp', () => {
    it('keeps the later stored amendment', async () => {
      const date = '2024-02-22T17:29:39Z';
      await amendments.create({
        date,
        invoiceId: 'inv-1',
        itemId: 'item-1',
        cost: 1000,
        taxRate: 0.2,
      });
      await amendments.create({
        date,
        invoiceId: 'inv-1',
        itemId: 'item-1',
        cost: 500,
        taxRate: 0.2,
      });

      await expect(positionAt(date)).resolves.toBe(100);
    });
  });
});
