import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { dateToEpoch } from '../../../common/iso-date';
import { SaleEvent, SaleItem } from './saleEvent.entity';

export interface CreateSaleEventInput {
  date: string;
  invoiceId: string;
  items: SaleItem[];
}

@Injectable()
export class SaleEventService {
  constructor(
    @InjectRepository(SaleEvent)
    private readonly repo: Repository<SaleEvent>,
  ) {}

  async create(input: CreateSaleEventInput): Promise<SaleEvent> {
    return this.repo.save(
      this.repo.create({
        ...input,
        dateEpoch: dateToEpoch(input.date),
      }),
    );
  }

  async findOnOrBefore(date: string): Promise<SaleEvent[]> {
    return this.repo.find({
      where: { dateEpoch: LessThanOrEqual(dateToEpoch(date)) },
    });
  }
}
