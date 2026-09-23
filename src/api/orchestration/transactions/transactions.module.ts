import { Module } from '@nestjs/common';
import { SaleEventModule } from '../../modules/saleEvent/saleEvent.module';
import { TaxPaymentEventModule } from '../../modules/taxPaymentEvent/taxPaymentEvent.module';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { IngestTransactionPipe } from './dto/ingest-transaction.pipe';

@Module({
  imports: [SaleEventModule, TaxPaymentEventModule],
  controllers: [TransactionsController],
  providers: [TransactionsService, IngestTransactionPipe],
  exports: [TransactionsService],
})
export class TransactionsModule {}
