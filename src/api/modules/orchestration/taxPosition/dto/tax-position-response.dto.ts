import { ApiProperty } from '@nestjs/swagger';

export class TaxPositionResponseDto {
  @ApiProperty({ example: '2024-02-22T17:29:39Z' })
  date!: string;

  @ApiProperty({
    example: 49,
    description: 'Sales tax minus payments, in pennies',
  })
  taxPosition!: number;
}
