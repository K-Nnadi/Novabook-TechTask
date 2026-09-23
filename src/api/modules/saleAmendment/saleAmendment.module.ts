import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SaleAmendment } from './saleAmendment.entity';
import { SaleAmendmentService } from './saleAmendment.service';

@Module({
  imports: [TypeOrmModule.forFeature([SaleAmendment])],
  providers: [SaleAmendmentService],
  exports: [SaleAmendmentService],
})
export class SaleAmendmentModule {}
