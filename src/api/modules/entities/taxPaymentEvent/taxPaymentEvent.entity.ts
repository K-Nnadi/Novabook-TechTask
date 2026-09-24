import { Column, Entity, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseDbEntity } from '../../../../utils/base-db.entity';

@Entity('tax_payment_event')
export class TaxPaymentEvent extends BaseDbEntity {
  @Column({ type: 'varchar' })
  @ApiProperty({ example: '2024-02-22T17:29:39Z' })
  date!: string;

  @Index('IDX_tax_payment_event_dateEpoch')
  @Column({ type: 'integer' })
  dateEpoch!: number;

  @Column({ type: 'integer' })
  @ApiProperty({ description: 'Amount in pennies' })
  amount!: number;
}
