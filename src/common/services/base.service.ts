import { DeepPartial, ObjectLiteral } from 'typeorm';
import { BaseRepository } from '../repositories/base.repository';

export class BaseService<T extends ObjectLiteral> {
  constructor(protected readonly repository: BaseRepository<T>) {}

  async create(dto: DeepPartial<T>): Promise<T> {
    const unsavedEntity = this.repository.create(dto);
    return await this.repository.save(unsavedEntity);
  }

  async findAll(): Promise<T[]> {
    return await this.repository.find();
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
