import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  Equals,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsIsoDateTime } from '../../../../common/iso-date';
import { SaleItemDto } from './sale-item.dto';

export enum EventType {
  SALES = 'SALES',
  TAX_PAYMENT = 'TAX_PAYMENT',
  AMEND = 'AMEND',
}

export class IngestSaleDto {
  @ApiProperty({ enum: [EventType.SALES] })
  @Equals(EventType.SALES, {
    message: 'eventType must be SALES or TAX_PAYMENT',
  })
  eventType!: EventType.SALES;

  @ApiProperty({ example: '2024-02-22T17:29:39Z' })
  @IsIsoDateTime()
  date!: string;

  @ApiProperty({ example: '3419027d-960f-4e8f-b8b7-f7b2b4791824' })
  @IsString()
  @IsNotEmpty()
  invoiceId!: string;

  @ApiProperty({ type: [SaleItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items!: SaleItemDto[];
}

export class IngestTaxPaymentDto {
  @ApiProperty({ enum: [EventType.TAX_PAYMENT] })
  @Equals(EventType.TAX_PAYMENT, {
    message: 'eventType must be SALES or TAX_PAYMENT',
  })
  eventType!: EventType.TAX_PAYMENT;

  @ApiProperty({ example: '2024-02-22T17:29:39Z' })
  @IsIsoDateTime()
  date!: string;

  @ApiProperty({ description: 'Amount in pennies', example: 74901 })
  @Type(() => Number)
  @IsInt({ message: 'amount must be an integer number of pennies' })
  @Min(0, { message: 'amount must not be negative' })
  amount!: number;
}

export type IngestTransactionDto = IngestSaleDto | IngestTaxPaymentDto;
