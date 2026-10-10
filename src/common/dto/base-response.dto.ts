import { HttpStatus } from '@nestjs/common';

export class BaseResponseDto<T> {
  data: T;

  constructor(data: T) {
    this.data = data;
  }
}
