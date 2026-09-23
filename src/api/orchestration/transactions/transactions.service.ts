import { Injectable, Logger } from '@nestjs/common';
import { SaleEventService } from '../../modules/saleEvent/saleEvent.service';
import { TaxPaymentEventService } from '../../modules/taxPaymentEvent/taxPaymentEvent.service';
import { EventType, IngestTransactionDto } from './dto/ingest-transaction.dto';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    private readonly sales: SaleEventService,
    private readonly payments: TaxPaymentEventService,
  ) {}

  async ingest(dto: IngestTransactionDto): Promise<void> {
    if (dto.eventType === EventType.SALES) {
      await this.sales.create({
        date: dto.date,
        invoiceId: dto.invoiceId,
        items: dto.items.map((item) => ({
          itemId: item.itemId,
          cost: item.cost,
          taxRate: item.taxRate,
        })),
      });
      this.logger.log({
        msg: 'ingested_sale',
        eventType: EventType.SALES,
        invoiceId: dto.invoiceId,
        itemCount: dto.items.length,
        date: dto.date,
      });
      return;
    }

    await this.payments.create({
      date: dto.date,
      amount: dto.amount,
    });
    this.logger.log({
      msg: 'ingested_tax_payment',
      eventType: EventType.TAX_PAYMENT,
      amount: dto.amount,
      date: dto.date,
    });
  }
}
