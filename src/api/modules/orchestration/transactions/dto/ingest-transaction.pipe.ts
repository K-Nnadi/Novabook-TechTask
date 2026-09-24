import { Injectable, PipeTransform } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { IsIn, validate } from 'class-validator';
import { validationExceptionFactory } from '../../../../errors/validation';
import {
  EventType,
  IngestSaleDto,
  IngestTaxPaymentDto,
  IngestTransactionDto,
} from './ingest-transaction.dto';

const INGEST_EVENT_TYPES = [EventType.SALES, EventType.TAX_PAYMENT] as const;

class IngestEventTypeDto {
  @IsIn(INGEST_EVENT_TYPES, {
    message: 'eventType must be SALES or TAX_PAYMENT',
  })
  eventType!: (typeof INGEST_EVENT_TYPES)[number];
}

@Injectable()
export class IngestTransactionPipe implements PipeTransform<
  unknown,
  Promise<IngestTransactionDto>
> {
  async transform(value: unknown): Promise<IngestTransactionDto> {
    const typeDto = plainToInstance(IngestEventTypeDto, value);
    const typeErrors = await validate(typeDto, {
      whitelist: true,
      forbidNonWhitelisted: false,
    });
    if (typeErrors.length > 0) {
      throw validationExceptionFactory(typeErrors);
    }

    if (typeDto.eventType === EventType.SALES) {
      const instance = plainToInstance(IngestSaleDto, value, {
        enableImplicitConversion: true,
      });
      const errors = await validate(instance, {
        whitelist: true,
        forbidNonWhitelisted: true,
      });
      if (errors.length > 0) {
        throw validationExceptionFactory(errors);
      }
      return instance;
    }

    const instance = plainToInstance(IngestTaxPaymentDto, value, {
      enableImplicitConversion: true,
    });
    const errors = await validate(instance, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length > 0) {
      throw validationExceptionFactory(errors);
    }
    return instance;
  }
}
