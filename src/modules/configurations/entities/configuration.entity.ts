import { BaseEntity } from 'src/common/entities/base.entity';
import { Column, Entity } from 'typeorm';

@Entity({ name: 'CONFIGURATIONS', schema: process.env['DB_SCHEMA_NAME'] })
export class Configuration extends BaseEntity {
  @Column()
  key: string;

  @Column({ type: 'clob' })
  value: string;
}
