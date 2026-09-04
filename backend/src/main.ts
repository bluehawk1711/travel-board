import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import compression from 'compression';
import helmet from 'helmet';
// import { doubleCsrf } from 'csrf-csrf';
async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  app.use(compression());
  app.use(helmet());
  app.enableCors();

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
