import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Wso2User } from 'src/modules/auth/types/authenticated-request';
import { Partner } from 'src/modules/partners/entities/partner.entity';
import { redact } from '../helpers/redact';

type LoggedRequest = Request & {
  user?: Wso2User;
  partner?: Partner;
};

// Logs every incoming request — who called it, which handler served it,
// response time, and a redacted payload. Runs as an interceptor (guards
// run before interceptors), so request.user (JwtAuthGuard, Phase 1) and
// request.partner (PartnerContextGuard, Phase 3, where applicable) are
// already populated by the time this executes — no need to re-decode the
// token here.
@Injectable()
export class AppHttpInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AppHttpInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    this.logger.log('🔥 AppHttpInterceptor invoked');
    const request = context.switchToHttp().getRequest<LoggedRequest>();
    const userAgent = request.get('user-agent') ?? '';
    const { method, originalUrl } = request;
    const body: unknown = request.body;
    const clientIp = this.resolveClientIp(request);
    const requestId = randomUUID();
    const now = Date.now();

    const identity =
      request.partner?.partnerCode ?? request.user?.wso2ClientId ?? 'anonymous';

    // No redaction on headers for now (unlike the payload below) — this
    // includes the raw Authorization / X-JWT-Assertion token value in
    // every log line. Revisit before this goes near production.
    const headers = JSON.stringify(request.headers);

    const baseMessage =
      `requestId=${requestId} caller=${identity} ` +
      `handler=${context.getClass().name}.${context.getHandler().name} ` +
      `${method} ${originalUrl} ip=${clientIp} userAgent=${userAgent} ` +
      `headers=${headers}`;

    const log = (error?: unknown) => {
      // Same redaction helper RestclientService uses (Phase 7) — this
      // handles real remittance data (account numbers, sender/beneficiary
      // identifiers), so nothing gets logged unmasked.
      const payload = this.safeStringify(redact(body));
      const responseTimeMs = Date.now() - now;
      const message = payload
        ? `${baseMessage} payload=${payload} responseTimeMs=${responseTimeMs}`
        : `${baseMessage} responseTimeMs=${responseTimeMs}`;

      this.logger.log(message);
      if (error) {
        const stack = error instanceof Error ? error.stack : undefined;
        this.logger.error(`requestId=${requestId} failed`);
      }
    };

    return next.handle().pipe(
      tap({
        next: () => log(),
        error: (err: unknown) => log(err),
      }),
    );
  }

  private resolveClientIp(request: Request): string {
    // Behind Traefik (docker-compose.yml) — first hop in X-Forwarded-For
    // is the real client, not the proxy.
    const forwardedFor = request.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
      return forwardedFor.split(',')[0].trim();
    }
    return request.socket?.remoteAddress ?? 'unknown';
  }

  private safeStringify(payload: unknown): string | undefined {
    if (payload === undefined || payload === null) {
      return undefined;
    }
    if (typeof payload === 'object' && Object.keys(payload).length === 0) {
      return undefined;
    }
    try {
      return JSON.stringify(payload);
    } catch {
      return '[unserializable]';
    }
  }
}
