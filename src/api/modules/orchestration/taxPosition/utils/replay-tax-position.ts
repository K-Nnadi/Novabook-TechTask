import { SaleItem } from '../../../entities/saleEvent/saleEvent.entity';
import { EventType } from '../../transactions/dto/ingest-transaction.dto';
import { itemTaxInPennies } from './item-tax';
import { StoredTaxEvent } from './tax-event';

type ItemsOnInvoice = Map<string, SaleItem>;

/**
 * Tax position is sales tax still on the books, minus tax payments.
 *
 * Callers pass events already sorted with `compareForReplay`, and already
 * limited to those on or before the query date. This function does not
 * filter by date and does not reset at a financial year.
 *
 * A sale or an amendment replaces only the items it names. Other items on
 * that invoice stay, including items that an amendment introduced before
 * any sale existed.
 */
export function replayTaxPosition(events: StoredTaxEvent[]): number {
  const invoices = new Map<string, ItemsOnInvoice>();
  let paymentsInPennies = 0;

  for (const event of events) {
    const payload = event.payload;
    switch (payload.kind) {
      case EventType.SALES:
        replaceNamedItems(invoices, payload.invoiceId, payload.items);
        break;
      case EventType.TAX_PAYMENT:
        paymentsInPennies += payload.amount;
        break;
      case EventType.AMEND:
        replaceNamedItems(invoices, payload.invoiceId, [
          {
            itemId: payload.itemId,
            cost: payload.cost,
            taxRate: payload.taxRate,
          },
        ]);
        break;
    }
  }

  return salesTaxInPennies(invoices) - paymentsInPennies;
}

function replaceNamedItems(
  invoices: Map<string, ItemsOnInvoice>,
  invoiceId: string,
  items: SaleItem[],
): void {
  const current = invoices.get(invoiceId) ?? new Map<string, SaleItem>();
  for (const item of items) {
    current.set(item.itemId, {
      itemId: item.itemId,
      cost: item.cost,
      taxRate: item.taxRate,
    });
  }
  invoices.set(invoiceId, current);
}

function salesTaxInPennies(invoices: Map<string, ItemsOnInvoice>): number {
  let total = 0;
  for (const items of invoices.values()) {
    for (const item of items.values()) {
      total += itemTaxInPennies(item.cost, item.taxRate);
    }
  }
  return total;
}
