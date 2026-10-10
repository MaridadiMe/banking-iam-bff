import {
  Injectable,
  InternalServerErrorException,
  Logger,
  Req,
  RequestMethod,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RestclientService } from '../rest-client/restclient.service';
import { encode } from 'base-64';

@Injectable()
export class HdpayClientService {
  private readonly logger = new Logger(HdpayClientService.name);
  private token: string | null = null;
  private tokenExpiryTime = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly restClient: RestclientService,
  ) {}

  public async sendRequest({
    method,
    url,
    payload,
    params,
    timeoutMs,
  }: {
    method: RequestMethod;
    url: string;
    payload: any;
    params?: Record<string, unknown>;
    timeoutMs?: number;
  }): Promise<any> {
    try {
      const accessToken = await this.getToken();
      const headers = this.setRequestHeaders();
      headers['Authorization'] = `Bearer ${accessToken}`;
      return await this.restClient.request({
        url,
        method,
        payload,
        headers,
        logPayload: true,
        params,
        timeoutMs,
      });
    } catch (e: any) {
      this.logger.error('Error sending request to HDPAY', e?.message);
      throw new InternalServerErrorException('Error While Sending Request');
    }
  }

  public async getToken(): Promise<string | null> {
    if (!this.tokenIsExpired()) {
      return this.token;
    }

    const credentials = `Basic ${this.configService.get<string>('HDPAY_AUTH_BASIC')}`;

    const headers = {
      Authorization: credentials,
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: `${this.configService.get<string>('HDPAY_AUTH_COOKIE')}`,
    };

    const payload = {
      USERID: this.configService.get<string>('HDPAY_EDX_CHANNEL_CODE') ?? '',
      PASSWORD: this.configService.get<string>('HDPAY_EDX_CHANNEL_CODE') ?? '',
      CHCODE: this.configService.get<string>('HDPAY_EDX_CHANNEL_CODE') ?? '',
    };

    let tokenResponse: any;

    try {
      tokenResponse = await this.restClient.request({
        url: `${this.configService.get('HDPAY_BASE_URL')}${this.configService.get('HDPAY_TOKEN_ENDPOINT')}`,
        method: RequestMethod.POST,
        headers,
        payload,
        logPayload: true,
      });
    } catch (error) {
      this.logger.error('Error acquiring token from HDPAY', error);
      throw new Error('Failed to acquire token from HDPAY');
    }

    const tokenMap = this.parseTokenResponse(tokenResponse);
    this.storeToken(tokenMap);
    return tokenMap['access_token'];
  }

  private setRequestHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ChannelID:
        this.configService.get<string>('HDPAY_EDX_CHANNEL_CODE') || 'EXIM EDX',
      Version: this.configService.get<string>('HDPAY_API_VERSION') || '1.0',
    };
  }

  private parseTokenResponse(responseBody: any): Record<string, string> {
    const tokenMap: Record<string, string> = {};
    tokenMap['access_token'] = responseBody['token'] ?? null;
    tokenMap['expires_in'] = responseBody['expires'] ?? null;
    return tokenMap;
  }

  private storeToken(tokenResponse: Record<string, string>): void {
    this.token = tokenResponse['access_token'];
    this.tokenExpiryTime =
      Date.now() + Number(tokenResponse['expires_in']) * 1000;
  }

  private tokenIsExpired(): boolean {
    if (!this.token) {
      return true;
    }
    return Date.now() > this.tokenExpiryTime;
  }

  @Cron(CronExpression.EVERY_30_MINUTES)
  private async refreshExpiredToken() {
    if (this.tokenIsExpired()) {
      this.logger.log('Acquiring token HDPAY...');
      try {
        await this.getToken();
        this.logger.log('HDPAY Token acquired successfully');
      } catch (e) {
        this.logger.error('Error acquiring HDPAY token', e);
      }
    }
  }

  private getErrorMessages(responseString: string): string {
    try {
      // Do actual implementation
      return responseString;
    } catch (e) {
      return `HDPAY Error: ${responseString}`;
    }
  }
}
