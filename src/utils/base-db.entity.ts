import {
  BaseEntity as BaseTypeOrmEntity,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type EntityMetadata = Record<string, unknown>;

export abstract class BaseDbEntity extends BaseTypeOrmEntity {
  @PrimaryGeneratedColumn()
  @ApiProperty()
  id!: number;

  @CreateDateColumn()
  @ApiPropertyOptional()
  createdAt!: Date;

  @UpdateDateColumn()
  @ApiPropertyOptional()
  updatedAt!: Date;

  @DeleteDateColumn()
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  deletedAt!: Date | null;

  @Column({ type: 'simple-json', nullable: true })
  @ApiPropertyOptional({
    description: 'Extensible JSON for future fields. Unused by tax replay.',
    nullable: true,
  })
  metadata?: EntityMetadata | null;
}
