import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SCOPES_KEY } from '../decorators/scopes.decorator';
import { AuthenticatedRequest } from '../types/authenticated-request';

@Injectable()
export class ScopesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    Logger.debug(
      `Checking if route is public: ${context.getHandler().name}`,
      ScopesGuard.name,
    );
    const requiredScopes = this.reflector.get<string[]>(
      SCOPES_KEY,
      context.getHandler(),
    );
    if (!requiredScopes || requiredScopes.length === 0) {
      return true;
    }

    // Set by JwtStrategy.validate()
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user || !user.scope) {
      Logger.error('User Does Not Have Required Scopes', ScopesGuard.name);
      throw new ForbiddenException('User Does Not Have Required Scopes');
    }

    const hasScope = requiredScopes.every((scope) =>
      user.scope.includes(scope),
    );

    if (!hasScope) {
      throw new ForbiddenException('Insufficient Scopes');
    }

    return true;
  }
}
