import { Injectable, Logger } from '@nestjs/common';
import { SaleAmendmentService } from '../../modules/saleAmendment/saleAmendment.service';
import { SaleEventService } from '../../modules/saleEvent/saleEvent.service';
import { TaxPaymentEventService } from '../../modules/taxPaymentEvent/taxPaymentEvent.service';
import { TaxPositionResponseDto } from './dto/tax-position-response.dto';
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
          kind: 'SALES' as const,
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
          kind: 'TAX_PAYMENT' as const,
          date: row.date,
          amount: row.amount,
        },
      })),
      ...amendments.map((row) => ({
        id: row.id,
        date: row.date,
        ingestedAt: row.createdAt,
        payload: {
          kind: 'AMEND' as const,
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
