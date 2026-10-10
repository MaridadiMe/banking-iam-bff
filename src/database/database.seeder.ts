import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export const seedDatabase = async (dataSource: DataSource) => {
  const isInitialized: boolean = dataSource.isInitialized;

  if (isInitialized && process.env.NODE_ENV === 'production') {
    Logger.debug(
      `Database Has Been Initialized, Attempting To Run Pending Migrations`,
      'Bootstrap',
    );
    try {
      const migrations = await dataSource.runMigrations();
      if (migrations.length > 0) {
        Logger.debug(`The Following Migrations Were Executed...`, 'Bootstrap');
        for (const migration of migrations) {
          Logger.debug(`-------- ${migration.name} ----------`, 'Bootstrap');
        }
      } else {
        Logger.debug(`No Pending Migrations Were Found`, 'Bootstrap');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      Logger.error(`Failed to run migrations: ${message}`, stack, 'Bootstrap');
      // Fail fast — don't let the app serve traffic against a broken/partial schema
      process.exit(1);
    }
  }
};
