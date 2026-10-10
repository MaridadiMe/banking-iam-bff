import { Request } from 'express';

// Shape returned by JwtStrategy.validate() (Phase 1), attached to
// request.user by passport.
export interface Wso2User {
  sub: string;
  wso2ClientId: string;
  scope: string[];
  [key: string]: unknown;
}

export interface AuthenticatedRequest extends Request {
  user: Wso2User;
}
