import { Module } from '@nestjs/common';
import { SaleAmendmentModule } from '../../modules/saleAmendment/saleAmendment.module';
import { SaleController } from './sale.controller';

@Module({
  imports: [SaleAmendmentModule],
  controllers: [SaleController],
})
export class SaleModule {}
