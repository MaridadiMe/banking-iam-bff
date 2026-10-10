import {
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { IS_PUBLIC_ROUTE_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  // Params/return stay `any` to match IAuthGuard.handleRequest<TUser = any>'s
  // signature (Passport's own typing) — narrow locally instead of trying to
  // tighten the override signature, which TS rejects as incompatible.
  handleRequest<TUser = any>(err: any, user: any, info: any): TUser {
    if (err || !user) {
      const errMessage: unknown =
        err instanceof Error ? err.message : undefined;
      const infoMessage: unknown =
        info instanceof Error ? info.message : undefined;
      Logger.error(
        `JWT auth failed: ${String(errMessage ?? infoMessage)}`,
        JwtAuthGuard.name,
      );
      throw err || new UnauthorizedException(infoMessage);
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Passport's own API is untyped here
    return user;
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublicRoute = this.reflector.get<boolean>(
      IS_PUBLIC_ROUTE_KEY,
      context.getHandler(),
    );
    if (isPublicRoute) {
      return true;
    }

    return super.canActivate(context);
  }
}
