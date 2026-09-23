import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { dateToEpoch } from '../../common/iso-date';
import { SaleAmendment } from './saleAmendment.entity';

export interface CreateSaleAmendmentInput {
  date: string;
  invoiceId: string;
  itemId: string;
  cost: number;
  taxRate: number;
}

@Injectable()
export class SaleAmendmentService {
  private readonly logger = new Logger(SaleAmendmentService.name);

  constructor(
    @InjectRepository(SaleAmendment)
    private readonly repo: Repository<SaleAmendment>,
  ) {}

  async create(input: CreateSaleAmendmentInput): Promise<SaleAmendment> {
    const saved = await this.repo.save(
      this.repo.create({
        ...input,
        dateEpoch: dateToEpoch(input.date),
      }),
    );
    this.logger.log({
      msg: 'amended_sale',
      invoiceId: saved.invoiceId,
      itemId: saved.itemId,
      date: saved.date,
    });
    return saved;
  }

  async findOnOrBefore(date: string): Promise<SaleAmendment[]> {
    return this.repo.find({
      where: { dateEpoch: LessThanOrEqual(dateToEpoch(date)) },
    });
  }
}
