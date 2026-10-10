import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt/jwt.strategy';

// EDX_IMT only validates tokens issued elsewhere (WSO2) — this service is a
// resource server only. No login/local-strategy, no AuthController, no
// password-grant DTOs (unlike the `iam` reference, which issues tokens).
@Module({
  imports: [PassportModule, ConfigModule],
  providers: [JwtStrategy],
})
export class AuthModule {}
