import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { IsIsoDateTime } from '../../../../common/iso-date';

export class AmendSaleDto {
  @ApiProperty({ example: '2024-02-22T17:29:39Z' })
  @IsIsoDateTime()
  date!: string;

  @ApiProperty({ example: '3419027d-960f-4e8f-b8b7-f7b2b4791824' })
  @IsString()
  @IsNotEmpty()
  invoiceId!: string;

  @ApiProperty({ example: '02db47b6-fe68-4005-a827-24c6e962f3df' })
  @IsString()
  @IsNotEmpty()
  itemId!: string;

  @ApiProperty({ description: 'Amount in pennies', example: 798 })
  @Type(() => Number)
  @IsInt({ message: 'cost must be an integer number of pennies' })
  @Min(0, { message: 'cost must not be negative' })
  cost!: number;

  @ApiProperty({ example: 0.15 })
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'taxRate must not be negative' })
  taxRate!: number;
}
