import { Column, Entity, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDbEntity } from '../../../utils/base-db.entity';

export interface SaleItem {
  itemId: string;
  cost: number;
  taxRate: number;
}

@Entity('sale_event')
export class SaleEvent extends BaseDbEntity {
  @Column({ type: 'varchar' })
  @ApiProperty({ example: '2024-02-22T17:29:39Z' })
  date!: string;

  @Index('IDX_sale_event_dateEpoch')
  @Column({ type: 'integer' })
  dateEpoch!: number;

  @Column({ type: 'varchar' })
  @ApiProperty()
  invoiceId!: string;

  @Column({ type: 'simple-json' })
  @ApiProperty()
  items!: SaleItem[];
}
