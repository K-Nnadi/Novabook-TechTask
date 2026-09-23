import { Module } from '@nestjs/common';
import { SaleAmendmentModule } from '../../modules/saleAmendment/saleAmendment.module';
import { SaleEventModule } from '../../modules/saleEvent/saleEvent.module';
import { TaxPaymentEventModule } from '../../modules/taxPaymentEvent/taxPaymentEvent.module';
import { TaxPositionController } from './taxPosition.controller';
import { TaxPositionService } from './taxPosition.service';

@Module({
  imports: [SaleEventModule, TaxPaymentEventModule, SaleAmendmentModule],
  controllers: [TaxPositionController],
  providers: [TaxPositionService],
  exports: [TaxPositionService],
})
export class TaxPositionModule {}
