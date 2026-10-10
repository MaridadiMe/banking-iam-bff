import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Algorithm } from 'jsonwebtoken';
import { passportJwtSecret } from 'jwks-rsa';
import { Wso2User } from '../../types/authenticated-request';
import * as https from 'https';

// WSO2's gateway sits in front of this service and does NOT forward the
// client's original OAuth2 access token — it validates that token itself,
// then mints its own JWT ("backend JWT" / WSO2's JWT Generator feature)
// carrying gateway-derived context (subscriber, application, tier,
// subscribedAPIs, etc.), signed with the gateway's own key, and attaches
// it as `X-JWT-Assertion`. This service therefore trusts "WSO2 says this
// request is authenticated" rather than independently re-validating the
// original client credential — which makes it critical that this service
// is unreachable except through WSO2 at the network level (Traefik/policy
// must guarantee that, not just convention), since JWT signature
// validation below is the only thing standing between an attacker and a
// forged identity.
//
// Confirmed: the backend JWT is signed with the same key exposed at
// WSO2_JWKS_URI (no separate signing endpoint needed). NOT YET confirmed:
// the exact claim shape of a real X-JWT-Assertion payload from this
// deployment — validate() below defends against both the `client_id`
// naming (confirmed on a direct OAuth2 access token, Phase 1) and
// `consumerKey` (WSO2's documented default claim name for the backend
// JWT's consumer key). Flag to whoever owns the WSO2 Gateway/JWT Generator
// config to confirm which applies here.
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super(JwtStrategy.buildOptions(configService));
  }

  private static buildOptions(configService: ConfigService) {
    const jwksUri = configService.get<string>('WSO2_JWKS_URI');
    Logger.debug(`Using JWKS URI2: ${jwksUri}`, JwtStrategy.name);
    const wso2backendJwtHeader =
      configService.get<string>('WSO2_BACKEND_JWT_HEADER') ?? 'X-JWT-Assertion';
    if (!jwksUri) {
      throw new Error('WSO2_JWKS_URI is not configured');
    }

    Logger.debug(
      `Using HEADER TOKEN: ${wso2backendJwtHeader}`,
      JwtStrategy.name,
    );

    const isDevelopment =
      configService.get<string>('NODE_ENV') === 'development';

    if (isDevelopment) {
      Logger.warn(
        'JWKS TLS certificate validation is DISABLED because NODE_ENV=development',
        JwtStrategy.name,
      );
    }

    const httpsAgent = isDevelopment
      ? new https.Agent({
          rejectUnauthorized: false,
        })
      : undefined;

    return {
      // Not fromAuthHeaderAsBearerToken() — WSO2 doesn't forward the
      // original Authorization header, it puts its own signed JWT in
      // X-JWT-Assertion instead (raw token, no "Bearer " prefix).
      jwtFromRequest: ExtractJwt.fromHeader(wso2backendJwtHeader),
      ignoreExpiration: false,
      audience: configService.get<string>('WSO2_EXPECTED_AUD'),
      issuer: configService.get<string>('WSO2_ISSUER'),
      algorithms: ['RS256'] as Algorithm[],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri,

        ...(httpsAgent && {
          requestAgent: httpsAgent,
        }),
      }),
    };
  }

  validate(payload: Record<string, unknown>): Wso2User {
    Logger.debug(`JWT payload: ${JSON.stringify(payload)}`, JwtStrategy.name);

    // Do NOT use `sub` for partner/client mapping — on a direct OAuth2
    // access token it was WSO2's internal Application ID (Phase 1), and on
    // the backend JWT it's typically the end-user/subscriber, neither of
    // which is the consumer key.
    //
    // `client_id` was confirmed on a direct OAuth2 access token;
    // `consumerKey` is WSO2's documented claim name for the consumer key
    // on its gateway-generated backend JWT. Try both until confirmed
    // against a real X-JWT-Assertion sample from this deployment (see the
    // class-level comment above) — and fail loudly rather than silently
    // falling back to something wrong.
    const { sub, client_id: clientId, consumerKey, scope, ...rest } = payload;

    const wso2ClientId = (clientId ?? consumerKey) as string | undefined;
    if (!wso2ClientId) {
      throw new UnauthorizedException(
        'Token has neither client_id nor consumerKey — cannot resolve partner identity',
      );
    }

    const pad = {
      sub: sub as string,
      wso2ClientId,
      scope: typeof scope === 'string' ? scope.split(' ') : [],
      ...rest,
    };

    return pad;
  }
}
