import { CreateSaleAmendmentInput } from '../src/api/modules/saleAmendment/saleAmendment.service';
import { SaleAmendment } from '../src/api/modules/saleAmendment/saleAmendment.entity';
import {
  SaleEvent,
  SaleItem,
} from '../src/api/modules/saleEvent/saleEvent.entity';
import { TaxPaymentEvent } from '../src/api/modules/taxPaymentEvent/taxPaymentEvent.entity';

class MemoryLedger<T extends { id: number; createdAt: Date; date: string }> {
  private nextId = 1;
  readonly rows: T[] = [];

  push(row: object): T {
    const saved = {
      ...row,
      id: this.nextId,
      createdAt: new Date(),
    } as T;
    this.nextId += 1;
    this.rows.push(saved);
    return saved;
  }

  onOrBefore(date: string): T[] {
    const epoch = Date.parse(date);
    return this.rows.filter((row) => Date.parse(row.date) <= epoch);
  }
}

export class InMemorySaleEventService {
  private readonly ledger = new MemoryLedger<SaleEvent>();

  async create(input: {
    date: string;
    invoiceId: string;
    items: SaleItem[];
  }): Promise<SaleEvent> {
    return this.ledger.push({
      ...input,
      dateEpoch: Date.parse(input.date),
      updatedAt: new Date(),
      deletedAt: null,
    });
  }

  async findOnOrBefore(date: string): Promise<SaleEvent[]> {
    return this.ledger.onOrBefore(date);
  }
}

export class InMemoryTaxPaymentEventService {
  private readonly ledger = new MemoryLedger<TaxPaymentEvent>();

  async create(input: {
    date: string;
    amount: number;
  }): Promise<TaxPaymentEvent> {
    return this.ledger.push({
      ...input,
      dateEpoch: Date.parse(input.date),
      updatedAt: new Date(),
      deletedAt: null,
    });
  }

  async findOnOrBefore(date: string): Promise<TaxPaymentEvent[]> {
    return this.ledger.onOrBefore(date);
  }
}

export class InMemorySaleAmendmentService {
  private readonly ledger = new MemoryLedger<SaleAmendment>();

  async create(input: CreateSaleAmendmentInput): Promise<SaleAmendment> {
    return this.ledger.push({
      ...input,
      dateEpoch: Date.parse(input.date),
      updatedAt: new Date(),
      deletedAt: null,
    });
  }

  async findOnOrBefore(date: string): Promise<SaleAmendment[]> {
    return this.ledger.onOrBefore(date);
  }
}
