import { Injectable, Logger } from '@nestjs/common';
import { SaleAmendmentService } from '../../entities/saleAmendment/saleAmendment.service';
import { SaleEventService } from '../../entities/saleEvent/saleEvent.service';
import { TaxPaymentEventService } from '../../entities/taxPaymentEvent/taxPaymentEvent.service';
import { TaxPositionResponseDto } from './dto/tax-position-response.dto';
import { EventType } from '../transactions/dto/ingest-transaction.dto';
import { compareStoredEvents, StoredTaxEvent } from './utils/tax-events';
import { replayTaxPosition } from './utils/taxPosition.calculator';

@Injectable()
export class TaxPositionService {
  private readonly logger = new Logger(TaxPositionService.name);

  constructor(
    private readonly sales: SaleEventService,
    private readonly payments: TaxPaymentEventService,
    private readonly amendments: SaleAmendmentService,
  ) {}

  async getTaxPosition(date: string): Promise<TaxPositionResponseDto> {
    const events = await this.collectEventsUpTo(date);
    const taxPosition = replayTaxPosition(events);
    this.logger.log({
      msg: 'queried_tax_position',
      date,
      eventCount: events.length,
      taxPosition,
    });
    return { date, taxPosition };
  }

  private async collectEventsUpTo(date: string): Promise<StoredTaxEvent[]> {
    const [sales, payments, amendments] = await Promise.all([
      this.sales.findOnOrBefore(date),
      this.payments.findOnOrBefore(date),
      this.amendments.findOnOrBefore(date),
    ]);

    const stored: StoredTaxEvent[] = [
      ...sales.map((row) => ({
        id: row.id,
        date: row.date,
        ingestedAt: row.createdAt,
        payload: {
          kind: EventType.SALES,
          date: row.date,
          invoiceId: row.invoiceId,
          items: row.items,
        },
      })),
      ...payments.map((row) => ({
        id: row.id,
        date: row.date,
        ingestedAt: row.createdAt,
        payload: {
          kind: EventType.TAX_PAYMENT,
          date: row.date,
          amount: row.amount,
        },
      })),
      ...amendments.map((row) => ({
        id: row.id,
        date: row.date,
        ingestedAt: row.createdAt,
        payload: {
          kind: EventType.AMEND,
          date: row.date,
          invoiceId: row.invoiceId,
          itemId: row.itemId,
          cost: row.cost,
          taxRate: row.taxRate,
        },
      })),
    ];

    return stored.sort(compareStoredEvents);
  }
}
