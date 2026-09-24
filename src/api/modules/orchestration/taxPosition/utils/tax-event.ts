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

/** One stored row, ready to replay. `ingestedAt` is the row's `createdAt`. */
export interface StoredTaxEvent {
  id: number;
  date: string;
  ingestedAt: Date;
  payload: TaxEvent;
}

/**
 * Query dates are inclusive. An event at the exact query instant counts.
 * Comparison is on the event `date`, not on when the row was stored.
 */
export function eventFallsOnOrBefore(
  eventDate: string,
  queryDate: string,
): boolean {
  return Date.parse(eventDate) <= Date.parse(queryDate);
}

/**
 * Replay order is the event date, earliest first.
 * Rows that share a date keep ingest order: `createdAt`, then `id`.
 */
export function compareForReplay(
  left: StoredTaxEvent,
  right: StoredTaxEvent,
): number {
  const byDate = Date.parse(left.date) - Date.parse(right.date);
  if (byDate !== 0) {
    return byDate;
  }
  const byIngestTime = left.ingestedAt.getTime() - right.ingestedAt.getTime();
  if (byIngestTime !== 0) {
    return byIngestTime;
  }
  return left.id - right.id;
}
