import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const setupSwagger = (app: INestApplication) => {
  const options = new DocumentBuilder()
    .setTitle('EDX_IMT_API')
    .setDescription('API for EDX_IMT (International Money Transfer)')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, options);
  const url = `${process.env.API_BASE_URL}/documentation`;
  SwaggerModule.setup(url, app, document);
};
