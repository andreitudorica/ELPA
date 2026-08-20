import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

export function createOpenApiDocument(app: NestFastifyApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('ELPA API')
    .setDescription('REST contract shared by the Recommendation Product and ELPA Data Studio.')
    .setVersion('0.1.0')
    .build();

  return cleanupOpenApiDoc(SwaggerModule.createDocument(app, config));
}
