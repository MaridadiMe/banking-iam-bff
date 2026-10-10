import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  RequestMethod,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError, AxiosResponse } from 'axios';
import { catchError, firstValueFrom, throwError } from 'rxjs';
import { Headers, Method } from 'src/common/types';
import { redact } from 'src/common/helpers/redact';

@Injectable()
export class RestclientService {
  private readonly logger = new Logger(RestclientService.name);
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async request({
    url,
    method,
    payload,
    headers,
    logPayload = true,
    params,
    timeoutMs,
  }: {
    url: string;
    method: RequestMethod;
    payload?: any;
    headers?: Headers;
    logPayload?: boolean;
    params?: Record<string, unknown>;
    timeoutMs?: number;
  }): Promise<unknown> {
    const now = Date.now();
    const getClient = () => {
      const options = {
        headers,
        params,
        timeout:
          timeoutMs ?? this.configService.get<number>('HTTP_TIMEOUT', 10000),
      };
      if (method === RequestMethod.POST) {
        return this.httpService.post(url, payload, options);
      }
      if (method === RequestMethod.PUT) {
        return this.httpService.put(url, payload, options);
      }
      if (method === RequestMethod.PATCH) {
        return this.httpService.patch(url, payload, options);
      }
      if (method === RequestMethod.DELETE) {
        return this.httpService.delete(url);
      }
      return this.httpService.get(url, options);
    };

    if (payload && logPayload === true) {
      this.logger.debug(
        `OutgoingRequestUrl = ${method} ${url} Payload = ${JSON.stringify(redact(payload))}`,
      );
    } else {
      this.logger.debug(`OutgoingRequestUrl = ${method} ${url}`);
    }

    const response = (await firstValueFrom(
      getClient().pipe(
        catchError((error: AxiosError) => this.handleHttpError(error)),
      ),
    )) as AxiosResponse<unknown>;
    const { data } = response;
    if (logPayload) {
      this.logger.debug(`Response = ${JSON.stringify(redact(data))}`);
    }
    this.logger.debug(
      `finished executing request ResponseTime = ${Date.now() - now}ms`,
    );
    return data;
  }

  private handleHttpError(error: AxiosError) {
    if (error.code === 'ECONNABORTED') {
      this.logger.error(`Request timed out: ${error.message}`);
      return throwError(
        () => new InternalServerErrorException('Request timed out'),
      );
    }

    const apiResponse = error.response?.data;
    this.logger.error(
      `${error.message} : \n ${JSON.stringify(redact(apiResponse))}`,
    );
    return throwError(
      () => new InternalServerErrorException(`${error.message}`),
    );
  }
}
