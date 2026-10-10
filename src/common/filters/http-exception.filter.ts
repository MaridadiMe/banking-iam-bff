import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let errorMessage: unknown =
      exception instanceof Error ? exception.message : 'Internal server error';

    if (exception instanceof BadRequestException && exception.getResponse) {
      const exceptionResponse = exception.getResponse();

      if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'message' in exceptionResponse
      ) {
        errorMessage = exceptionResponse.message;
      }
    }

    const errorResponse = {
      status: HttpStatus[status],
      error: {
        timestamp: new Date().getTime(),
        message: errorMessage,
      },
    };

    Logger.error(`HTTP Exception Caught`, HttpExceptionFilter.name);

    response.status(status).json(errorResponse);
  }
}
