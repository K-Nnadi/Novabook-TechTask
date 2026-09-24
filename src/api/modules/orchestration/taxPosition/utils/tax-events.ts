import { SaleItem } from '../../../entities/saleEvent/saleEvent.entity';
import { EventType } from '../../transactions/dto/ingest-transaction.dto';

export type TaxEvent =
  | {
      kind: EventType.SALES;
      date: string;
      invoiceId: string;
      items: SaleItem[];
    }
  | {
      kind: EventType.TAX_PAYMENT;
      date: string;
      amount: number;
    }
  | {
      kind: EventType.AMEND;
      date: string;
      invoiceId: string;
      itemId: string;
      cost: number;
      taxRate: number;
    };

export interface StoredTaxEvent {
  id: number;
  date: string;
  ingestedAt: Date;
  payload: TaxEvent;
}

export function compareStoredEvents(
  left: StoredTaxEvent,
  right: StoredTaxEvent,
): number {
  const leftMs = Date.parse(left.date);
  const rightMs = Date.parse(right.date);
  if (leftMs !== rightMs) {
    return leftMs - rightMs;
  }
  const ingest = left.ingestedAt.getTime() - right.ingestedAt.getTime();
  if (ingest !== 0) {
    return ingest;
  }
  return left.id - right.id;
}

export function isOnOrBefore(eventDate: string, queryDate: string): boolean {
  return Date.parse(eventDate) <= Date.parse(queryDate);
}
