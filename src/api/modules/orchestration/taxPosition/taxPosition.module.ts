import { Module } from '@nestjs/common';
import { SaleAmendmentModule } from '../../entities/saleAmendment/saleAmendment.module';
import { SaleEventModule } from '../../entities/saleEvent/saleEvent.module';
import { TaxPaymentEventModule } from '../../entities/taxPaymentEvent/taxPaymentEvent.module';
import { TaxPositionController } from './taxPosition.controller';
import { TaxPositionService } from './taxPosition.service';

@Module({
  imports: [SaleEventModule, TaxPaymentEventModule, SaleAmendmentModule],
  controllers: [TaxPositionController],
  providers: [TaxPositionService],
  exports: [TaxPositionService],
})
export class TaxPositionModule {}
