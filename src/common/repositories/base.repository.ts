import { InjectDataSource } from '@nestjs/typeorm';
import {
  DataSource,
  Repository,
  type EntityTarget,
  type ObjectLiteral,
} from 'typeorm';

export abstract class BaseRepository<
  T extends ObjectLiteral,
> extends Repository<T> {
  constructor(
    @InjectDataSource() dataSource: DataSource,
    entity: EntityTarget<T>,
  ) {
    super(entity, dataSource.createEntityManager());
  }
}
