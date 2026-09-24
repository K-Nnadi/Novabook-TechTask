import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class SaleItemDto {
  @ApiProperty({ example: '02db47b6-fe68-4005-a827-24c6e962f3df' })
  @IsString()
  @IsNotEmpty()
  itemId!: string;

  @ApiProperty({ description: 'Amount in pennies', example: 1099 })
  @Type(() => Number)
  @IsInt({ message: 'cost must be an integer number of pennies' })
  @Min(0, { message: 'cost must not be negative' })
  cost!: number;

  @ApiProperty({ example: 0.2 })
  @Type(() => Number)
  @IsNumber()
  @Min(0, { message: 'taxRate must not be negative' })
  taxRate!: number;
}
