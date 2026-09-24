import { Column, Entity, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDbEntity } from '../../../../utils/base-db.entity';

@Entity('sale_amendment')
export class SaleAmendment extends BaseDbEntity {
  @Column({ type: 'varchar' })
  @ApiProperty({ example: '2024-02-22T17:29:39Z' })
  date!: string;

  @Index('IDX_sale_amendment_dateEpoch')
  @Column({ type: 'integer' })
  dateEpoch!: number;

  @Column({ type: 'varchar' })
  @ApiProperty()
  invoiceId!: string;

  @Column({ type: 'varchar' })
  @ApiProperty()
  itemId!: string;

  @Column({ type: 'integer' })
  @ApiProperty({ description: 'Amount in pennies' })
  cost!: number;

  @Column({ type: 'float' })
  @ApiProperty()
  taxRate!: number;
}
