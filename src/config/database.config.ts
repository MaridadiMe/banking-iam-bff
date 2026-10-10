import { ConfigService } from '@nestjs/config';
import { OracleConnectionOptions } from 'typeorm/driver/oracle/OracleConnectionOptions';

import * as dotenv from 'dotenv';
import { initOracleClient } from 'oracledb';
import { Logger } from '@nestjs/common';

dotenv.config();

// Thick-client instant-client path, matching loans-decision-engine's pattern.
// NOTE: loans-decision-engine's own Dockerfile (node:20-slim) does not bake in
// an Instant Client, so this gate assumes LD_LIBRARY_PATH/artifacts/instantclient
// is supplied by the runtime environment in production. Confirm this matches
// how EDX_IMT will actually be deployed before relying on thick mode — see
// Phase 0 Dockerfile task and README "Open Questions".
if (process.env.DB_TYPE === 'oracle' && process.env.NODE_ENV === 'production') {
  const cwd = process.cwd();
  Logger.debug(`Initializing Oracle Client`);

  const libDir =
    process.env.LD_LIBRARY_PATH ?? `${cwd}/artifacts/instantclient`;
  initOracleClient({ libDir });
}

export const databaseConnectionOptions = (
  configService: ConfigService,
): OracleConnectionOptions => ({
  type: configService.get<string>('DB_TYPE', 'oracle') as 'oracle',
  host: configService.get<string>('DB_HOST'),
  port: parseInt(configService.get<string>('DB_PORT', '1522'), 10),
  username: configService.get<string>('DB_USER'),
  password: configService.get<string>('DB_PASSWORD'),
  synchronize: configService.get<string>('DB_SYNCHRONIZE') === 'true',
  logging: configService.get<string>('DB_LOGGING') === 'true',
  entities: [__dirname + '/../modules/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  serviceName: configService.get<string>('DB_SERVICE_NAME'),
  schema: configService.get<string>('DB_SCHEMA_NAME'),
  migrationsTableName: 'MIGRATIONS',
});
