import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SaleEvent } from './saleEvent.entity';
import { SaleEventService } from './saleEvent.service';

@Module({
  imports: [TypeOrmModule.forFeature([SaleEvent])],
  providers: [SaleEventService],
  exports: [SaleEventService],
})
export class SaleEventModule {}
