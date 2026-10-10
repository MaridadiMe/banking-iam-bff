import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';
import { initOracleClient } from 'oracledb';

dotenv.config();

if (process.env.DB_TYPE === 'oracle' && process.env.NODE_ENV === 'production') {
  const cwd = process.cwd();

  const libDir =
    process.env.LD_LIBRARY_PATH ?? `${cwd}/artifacts/instantclient`;
  initOracleClient({ libDir });
}

const options: DataSourceOptions = {
  type: 'oracle',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '1522'),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  schema: process.env.DB_SCHEMA_NAME,
  entities: [__dirname + '/../modules/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  serviceName: process.env.DB_SERVICE_NAME,
  migrationsTableName: 'MIGRATIONS',
};

const dataSource = new DataSource({
  ...options,
});

export default dataSource;
