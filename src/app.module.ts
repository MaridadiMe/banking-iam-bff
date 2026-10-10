import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { databaseConnectionOptions } from './config/database.config';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth-guard';
import { ScopesGuard } from './modules/auth/guards/scopes.guard';
import { AppHttpInterceptor } from './common/filters/app-http.interceptor';
import { FspModule } from './modules/fsp/fsp.module';
import { PartnersModule } from './modules/partners/partners.module';
import { AccountLookupModule } from './modules/account-lookup/account-lookup.module';
import { TransferModule } from './modules/transfer/transfer.module';
import { ConfigurationsModule } from './modules/configurations/configurations.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        databaseConnectionOptions(configService),
    }),
    // Powers the FSP/Partner (EVERY_MINUTE) and Configurations
    // (EVERY_10_MINUTES) cache-refresh crons.
    ScheduleModule.forRoot(),
    AuthModule,
    FspModule,
    PartnersModule,
    AccountLookupModule,
    TransferModule,
    ConfigurationsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ScopesGuard,
    },
    // {
    //   provide: APP_INTERCEPTOR,
    //   useClass: AppHttpInterceptor,
    // },
  ],
})
export class AppModule {}
