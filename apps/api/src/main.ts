import 'reflect-metadata';

import { Logger, RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app/app.module';
import { McpRouteCatalogService } from './app/mcp/mcp-route-catalog.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3000);

  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health', method: RequestMethod.ALL },
      { path: 'mcp', method: RequestMethod.ALL },
    ],
  });
  app.enableCors({
    origin: config.getOrThrow<string>('WEB_ORIGIN'),
    credentials: false,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Books MCP POC')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig, {
    operationIdFactory: (controllerKey, methodKey) =>
      `${controllerKey}_${methodKey}`,
  });
  app.get(McpRouteCatalogService).initialize(document);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
  });

  await app.listen(port, '0.0.0.0');
  Logger.log(`API:     http://localhost:${port}/api`, 'Bootstrap');
  Logger.log(`Swagger: http://localhost:${port}/api/docs`, 'Bootstrap');
  Logger.log(`MCP:     http://localhost:${port}/mcp`, 'Bootstrap');
}

void bootstrap();
