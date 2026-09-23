import { SaleItem } from '../../../modules/saleEvent/saleEvent.entity';
import { StoredTaxEvent } from './tax-events';

type InvoiceItems = Map<string, Map<string, SaleItem>>;

export function replayTaxPosition(events: StoredTaxEvent[]): number {
  const invoices: InvoiceItems = new Map();
  let payments = 0;

  for (const event of events) {
    const payload = event.payload;
    if (payload.kind === 'SALES') {
      const items =
        invoices.get(payload.invoiceId) ?? new Map<string, SaleItem>();
      for (const item of payload.items) {
        items.set(item.itemId, {
          itemId: item.itemId,
          cost: item.cost,
          taxRate: item.taxRate,
        });
      }
      invoices.set(payload.invoiceId, items);
      continue;
    }
    if (payload.kind === 'TAX_PAYMENT') {
      payments += payload.amount;
      continue;
    }
    const items =
      invoices.get(payload.invoiceId) ?? new Map<string, SaleItem>();
    items.set(payload.itemId, {
      itemId: payload.itemId,
      cost: payload.cost,
      taxRate: payload.taxRate,
    });
    invoices.set(payload.invoiceId, items);
  }

  let salesTax = 0;
  for (const items of invoices.values()) {
    for (const item of items.values()) {
      salesTax += Math.round(item.cost * item.taxRate);
    }
  }
  return salesTax - payments;
}
