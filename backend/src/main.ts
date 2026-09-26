import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap/configure-app';

async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule, {
      logger: false, // Disable NestJS verbose logging
    });

    const configService = app.get(ConfigService);
    const { port, apiPrefix } = configureApp(app);

  try {
    // Start server with explicit configuration
    const server = await app.listen(port);

    // Minimal startup message
    const logger = new Logger('Bootstrap');
    logger.log(`Database connected successfully, Server starting on port ${port}...`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();
