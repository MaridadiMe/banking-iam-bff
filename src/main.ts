import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { setupSwagger } from './config/swagger.config';
import { DataSource } from 'typeorm';
import { seedDatabase } from './database/database.seeder';

async function bootstrap() {
  //await fetchSecretsFromVault();

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix(process.env.API_BASE_URL ?? 'api/v1/iam');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  if (process.env.ENABLE_SWAGGER === 'true') {
    Logger.log('Swagger enabled', 'Bootstrap');
    setupSwagger(app);
  }

  const dataSource = app.get(DataSource);
  await seedDatabase(dataSource);

  const APP_PORT = +(process.env.APP_PORT || 3000);
  await app.listen(APP_PORT);
  Logger.log(`APP PORT: ${APP_PORT}`, 'Bootstrap');
}

void bootstrap();
