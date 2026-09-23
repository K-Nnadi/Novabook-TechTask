import { SaleAmendmentService } from '../src/api/modules/saleAmendment/saleAmendment.service';
import { SaleEventService } from '../src/api/modules/saleEvent/saleEvent.service';
import { TaxPaymentEventService } from '../src/api/modules/taxPaymentEvent/taxPaymentEvent.service';
import { TaxPositionService } from '../src/api/orchestration/taxPosition/taxPosition.service';
import { EventType } from '../src/api/orchestration/transactions/dto/ingest-transaction.dto';
import { TransactionsService } from '../src/api/orchestration/transactions/transactions.service';
import {
  InMemorySaleAmendmentService,
  InMemorySaleEventService,
  InMemoryTaxPaymentEventService,
} from './in-memory-ledger';

describe('Tax position orchestration', () => {
  let transactions: TransactionsService;
  let amendments: InMemorySaleAmendmentService;
  let taxPosition: TaxPositionService;

  beforeEach(() => {
    const sales = new InMemorySaleEventService() as unknown as SaleEventService;
    const payments =
      new InMemoryTaxPaymentEventService() as unknown as TaxPaymentEventService;
    amendments = new InMemorySaleAmendmentService();
    transactions = new TransactionsService(sales, payments);
    taxPosition = new TaxPositionService(
      sales,
      payments,
      amendments as unknown as SaleAmendmentService,
    );
  });

  const sale = async (
    date: string,
    invoiceId: string,
    items: { itemId: string; cost: number; taxRate: number }[],
  ): Promise<void> => {
    await transactions.ingest({
      eventType: EventType.SALES,
      date,
      invoiceId,
      items,
    });
  };

  const pay = async (date: string, amount: number): Promise<void> => {
    await transactions.ingest({
      eventType: EventType.TAX_PAYMENT,
      date,
      amount,
    });
  };

  it('returns 0 when there are no events', async () => {
    const result = await taxPosition.getTaxPosition('2024-02-22T17:29:39Z');
    expect(result).toEqual({
      date: '2024-02-22T17:29:39Z',
      taxPosition: 0,
    });
  });

  it('calculates tax from a sale only and rounds to nearest penny', async () => {
    await sale('2024-02-22T17:29:39Z', 'inv-1', [
      { itemId: 'item-1', cost: 1099, taxRate: 0.2 },
    ]);
    const result = await taxPosition.getTaxPosition('2024-02-22T17:29:39Z');
    expect(result.taxPosition).toBe(220);
  });

  it('subtracts a tax payment', async () => {
    await pay('2024-02-22T17:29:39Z', 100);
    const result = await taxPosition.getTaxPosition('2024-02-22T17:29:39Z');
    expect(result.taxPosition).toBe(-100);
  });

  it('combines sales tax and payments', async () => {
    await sale('2024-02-22T10:00:00Z', 'inv-1', [
      { itemId: 'item-1', cost: 1000, taxRate: 0.2 },
    ]);
    await pay('2024-02-22T12:00:00Z', 151);
    const result = await taxPosition.getTaxPosition('2024-02-22T17:29:39Z');
    expect(result.taxPosition).toBe(49);
  });

  it('excludes events after the query date', async () => {
    await sale('2024-02-22T18:00:00Z', 'inv-1', [
      { itemId: 'item-1', cost: 1000, taxRate: 0.2 },
    ]);
    const result = await taxPosition.getTaxPosition('2024-02-22T17:29:39Z');
    expect(result.taxPosition).toBe(0);
  });

  it('includes events on the query date (inclusive)', async () => {
    await sale('2024-02-22T17:29:39Z', 'inv-1', [
      { itemId: 'item-1', cost: 1000, taxRate: 0.2 },
    ]);
    const result = await taxPosition.getTaxPosition('2024-02-22T17:29:39Z');
    expect(result.taxPosition).toBe(200);
  });

  it('applies an amendment before the sale exists', async () => {
    await amendments.create({
      date: '2024-02-21T00:00:00Z',
      invoiceId: 'inv-1',
      itemId: 'item-1',
      cost: 500,
      taxRate: 0.2,
    });
    const beforeSale = await taxPosition.getTaxPosition('2024-02-21T12:00:00Z');
    expect(beforeSale.taxPosition).toBe(100);

    await sale('2024-02-22T00:00:00Z', 'inv-1', [
      { itemId: 'item-1', cost: 1000, taxRate: 0.2 },
    ]);
    const afterSale = await taxPosition.getTaxPosition('2024-02-22T00:00:00Z');
    expect(afterSale.taxPosition).toBe(200);
  });

  it('lets a later amendment override a sale item', async () => {
    await sale('2024-02-22T10:00:00Z', 'inv-1', [
      { itemId: 'item-1', cost: 1000, taxRate: 0.2 },
    ]);
    await amendments.create({
      date: '2024-02-22T12:00:00Z',
      invoiceId: 'inv-1',
      itemId: 'item-1',
      cost: 798,
      taxRate: 0.15,
    });
    const mid = await taxPosition.getTaxPosition('2024-02-22T11:00:00Z');
    expect(mid.taxPosition).toBe(200);
    const after = await taxPosition.getTaxPosition('2024-02-22T12:00:00Z');
    expect(after.taxPosition).toBe(Math.round(798 * 0.15));
  });

  it('applies multiple amendments in date order', async () => {
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
    expect(
      (await taxPosition.getTaxPosition('2024-03-01T00:00:00Z')).taxPosition,
    ).toBe(200);
    expect(
      (await taxPosition.getTaxPosition('2024-12-01T00:00:00Z')).taxPosition,
    ).toBe(50);
  });

  it('does not wipe other items when a sale lists a subset', async () => {
    await sale('2024-02-22T10:00:00Z', 'inv-1', [
      { itemId: 'a', cost: 1000, taxRate: 0.2 },
      { itemId: 'b', cost: 1000, taxRate: 0.2 },
    ]);
    await sale('2024-02-22T12:00:00Z', 'inv-1', [
      { itemId: 'a', cost: 500, taxRate: 0.2 },
    ]);
    const result = await taxPosition.getTaxPosition('2024-02-22T12:00:00Z');
    expect(result.taxPosition).toBe(100 + 200);
  });

  it('applies same-timestamp events in ingest order', async () => {
    const date = '2024-02-22T17:29:39Z';
    await sale(date, 'inv-1', [{ itemId: 'item-1', cost: 1000, taxRate: 0.2 }]);
    await pay(date, 50);
    const result = await taxPosition.getTaxPosition(date);
    expect(result.taxPosition).toBe(150);
  });

  it('accumulates indefinitely with no financial year reset', async () => {
    await sale('2023-01-01T00:00:00Z', 'inv-old', [
      { itemId: 'item-1', cost: 1000, taxRate: 0.2 },
    ]);
    await sale('2025-01-01T00:00:00Z', 'inv-new', [
      { itemId: 'item-2', cost: 1000, taxRate: 0.2 },
    ]);
    const result = await taxPosition.getTaxPosition('2025-06-01T00:00:00Z');
    expect(result.taxPosition).toBe(400);
  });

  it('respects a future event date only after that date', async () => {
    await sale('2030-01-01T00:00:00Z', 'inv-1', [
      { itemId: 'item-1', cost: 1000, taxRate: 0.2 },
    ]);
    expect(
      (await taxPosition.getTaxPosition('2024-01-01T00:00:00Z')).taxPosition,
    ).toBe(0);
    expect(
      (await taxPosition.getTaxPosition('2030-01-01T00:00:00Z')).taxPosition,
    ).toBe(200);
  });
});
