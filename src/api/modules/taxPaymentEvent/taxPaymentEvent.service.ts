import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { dateToEpoch } from '../../common/iso-date';
import { TaxPaymentEvent } from './taxPaymentEvent.entity';

export interface CreateTaxPaymentEventInput {
  date: string;
  amount: number;
}

@Injectable()
export class TaxPaymentEventService {
  constructor(
    @InjectRepository(TaxPaymentEvent)
    private readonly repo: Repository<TaxPaymentEvent>,
  ) {}

  async create(input: CreateTaxPaymentEventInput): Promise<TaxPaymentEvent> {
    return this.repo.save(
      this.repo.create({
        ...input,
        dateEpoch: dateToEpoch(input.date),
      }),
    );
  }

  async findOnOrBefore(date: string): Promise<TaxPaymentEvent[]> {
    return this.repo.find({
      where: { dateEpoch: LessThanOrEqual(dateToEpoch(date)) },
    });
  }
}
