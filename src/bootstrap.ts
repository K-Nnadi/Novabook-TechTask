import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from '@fastify/helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './api/errors/http-exception.filter';
import { validationExceptionFactory } from './api/errors/validation';
import { AppSettings } from './config/app.config';

type TimedRequest = {
  _requestStartMs?: number;
  headers: Record<string, unknown>;
  method: string;
  url: string;
};

export async function bootstrap(options?: {
  listen?: boolean;
}): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
  );
  const settings = app.get(ConfigService).getOrThrow<AppSettings>('app');

  const fastify = app.getHttpAdapter().getInstance() as unknown as {
    register: (plugin: unknown, opts?: unknown) => Promise<unknown>;
    addHook: (
      name: string,
      handler: (
        request: TimedRequest,
        reply: { statusCode: number },
      ) => Promise<void>,
    ) => void;
  };

  await fastify.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  });

  if (settings.corsOrigin !== false) {
    app.enableCors({ origin: settings.corsOrigin });
  }
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  const httpLogger = new Logger('HTTP');
  if (settings.requestLogging) {
    fastify.addHook('onRequest', async (request) => {
      request._requestStartMs = Date.now();
    });
    fastify.addHook('onResponse', async (request, reply) => {
      const started = request._requestStartMs ?? Date.now();
      const requestIdHeader = request.headers['x-request-id'];
      const trace = request.headers['x-cloud-trace-context'];
      const requestId =
        typeof requestIdHeader === 'string'
          ? requestIdHeader
          : typeof trace === 'string'
            ? trace.split('/')[0]
            : undefined;
      const path = request.url.split('?')[0] ?? request.url;
      httpLogger.log({
        type: 'http',
        method: request.method,
        path,
        statusCode: reply.statusCode,
        durationMs: Date.now() - started,
        requestId,
      });
    });
  }

  const swagger = new DocumentBuilder()
    .setTitle('Novabook Tax Service')
    .setDescription(
      'Ingest sales and tax payments, amend sales, and query tax position at a point in time.',
    )
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('api-docs', app, document);

  if (options?.listen === false) {
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    return app;
  }

  await app.listen(settings.port, settings.host);
  const swaggerHost = settings.host === '0.0.0.0' ? 'localhost' : settings.host;
  new Logger('Bootstrap').log(
    `Swagger docs: http://${swaggerHost}:${settings.port}/api-docs`,
  );
  return app;
}
