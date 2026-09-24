import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaxPaymentEvent } from './taxPaymentEvent.entity';
import { TaxPaymentEventService } from './taxPaymentEvent.service';

@Module({
  imports: [TypeOrmModule.forFeature([TaxPaymentEvent])],
  providers: [TaxPaymentEventService],
  exports: [TaxPaymentEventService],
})
export class TaxPaymentEventModule {}
