import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import helmet from 'helmet';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { UPLOAD_DIR } from './uploads/uploads.controller';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

/** Request id is attached by bootstrap for log correlation (M8). */
interface RequestWithId extends Request {
  id: string;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: false,
  });
  const configService = app.get(ConfigService);
  app.useLogger(app.get(Logger));

  // Request ID for log correlation (M8).
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const withId = req as RequestWithId;
    withId.id =
      (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
    next();
  });

  app.use(cookieParser());

  // Uploaded images served from disk with 1-day browser cache (L1/L7).
  app.useStaticAssets(UPLOAD_DIR, { prefix: '/uploads', maxAge: '1d' });
  app.use(compression());
  app.use(
    helmet({
      contentSecurityPolicy: false,
      frameguard: { action: 'deny' },
      noSniff: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  const frontendUrl = configService.get<string>(
    'FRONTEND_URL',
    'http://localhost:3001',
  );
  app.enableCors({
    origin: [frontendUrl],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
