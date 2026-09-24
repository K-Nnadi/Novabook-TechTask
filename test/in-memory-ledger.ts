import { SaleAmendmentService } from '../src/api/modules/entities/saleAmendment/saleAmendment.service';
import { SaleAmendment } from '../src/api/modules/entities/saleAmendment/saleAmendment.entity';
import {
  SaleEvent,
  SaleItem,
} from '../src/api/modules/entities/saleEvent/saleEvent.entity';
import { SaleEventService } from '../src/api/modules/entities/saleEvent/saleEvent.service';
import { TaxPaymentEvent } from '../src/api/modules/entities/taxPaymentEvent/taxPaymentEvent.entity';
import { TaxPaymentEventService } from '../src/api/modules/entities/taxPaymentEvent/taxPaymentEvent.service';
import { TaxPositionService } from '../src/api/modules/orchestration/taxPosition/taxPosition.service';
import { eventFallsOnOrBefore } from '../src/api/modules/orchestration/taxPosition/utils/tax-event';
import { TransactionsService } from '../src/api/modules/orchestration/transactions/transactions.service';

/**
 * Append-only stand-in for one TypeORM table.
 * `findOnOrBefore` uses the same inclusive date rule as the SQL filter.
 */
class InMemoryTable<T extends { date: string }> {
  private nextId = 1;
  private readonly rows: T[] = [];

  insert(row: object): T {
    const saved = {
      ...row,
      id: this.nextId,
      createdAt: new Date(),
    } as unknown as T;
    this.nextId += 1;
    this.rows.push(saved);
    return saved;
  }

  findOnOrBefore(queryDate: string): T[] {
    return this.rows.filter((row) => eventFallsOnOrBefore(row.date, queryDate));
  }
}

export class InMemorySaleEventService {
  private readonly table = new InMemoryTable<SaleEvent>();

  async create(input: {
    date: string;
    invoiceId: string;
    items: SaleItem[];
  }): Promise<SaleEvent> {
    return this.table.insert({
      ...input,
      dateEpoch: Date.parse(input.date),
      updatedAt: new Date(),
      deletedAt: null,
    });
  }

  async findOnOrBefore(date: string): Promise<SaleEvent[]> {
    return this.table.findOnOrBefore(date);
  }
}

export class InMemoryTaxPaymentEventService {
  private readonly table = new InMemoryTable<TaxPaymentEvent>();

  async create(input: {
    date: string;
    amount: number;
  }): Promise<TaxPaymentEvent> {
    return this.table.insert({
      ...input,
      dateEpoch: Date.parse(input.date),
      updatedAt: new Date(),
      deletedAt: null,
    });
  }

  async findOnOrBefore(date: string): Promise<TaxPaymentEvent[]> {
    return this.table.findOnOrBefore(date);
  }
}

export class InMemorySaleAmendmentService {
  private readonly table = new InMemoryTable<SaleAmendment>();

  async create(input: {
    date: string;
    invoiceId: string;
    itemId: string;
    cost: number;
    taxRate: number;
  }): Promise<SaleAmendment> {
    return this.table.insert({
      ...input,
      dateEpoch: Date.parse(input.date),
      updatedAt: new Date(),
      deletedAt: null,
    });
  }

  async findOnOrBefore(date: string): Promise<SaleAmendment[]> {
    return this.table.findOnOrBefore(date);
  }
}

/** The three ledgers, wired the same way the Nest module wires them. */
export function openInMemoryLedger(): {
  transactions: TransactionsService;
  amendments: InMemorySaleAmendmentService;
  taxPosition: TaxPositionService;
} {
  const sales = new InMemorySaleEventService() as unknown as SaleEventService;
  const payments =
    new InMemoryTaxPaymentEventService() as unknown as TaxPaymentEventService;
  const amendments = new InMemorySaleAmendmentService();
  return {
    transactions: new TransactionsService(sales, payments),
    amendments,
    taxPosition: new TaxPositionService(
      sales,
      payments,
      amendments as unknown as SaleAmendmentService,
    ),
  };
}
