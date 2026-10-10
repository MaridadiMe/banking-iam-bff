import { ObjectLiteral } from 'typeorm';
import { BaseService } from '../services/base.service';

export class BaseController<T extends ObjectLiteral> {
  constructor(protected readonly service: BaseService<T>) {}
}
