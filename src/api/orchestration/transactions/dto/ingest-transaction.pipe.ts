import { Injectable, PipeTransform } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { IsEnum, validate } from 'class-validator';
import { validationExceptionFactory } from '../../../errors/validation';
import {
  EventType,
  IngestSaleDto,
  IngestTaxPaymentDto,
  IngestTransactionDto,
} from './ingest-transaction.dto';

class IngestEventTypeDto {
  @IsEnum(EventType, {
    message: 'eventType must be SALES or TAX_PAYMENT',
  })
  eventType!: EventType;
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
