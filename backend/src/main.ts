import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  configureApp(app);

  // La documentación solo se expone fuera de producción.
  if (config.get('NODE_ENV') !== 'production') {
    const options = new DocumentBuilder()
      .setTitle('SocialPulse AI API')
      .setDescription('API REST de SocialPulse AI')
      .setVersion('0.1.0')
      .build();
    SwaggerModule.setup(
      'api/docs',
      app,
      SwaggerModule.createDocument(app, options),
    );
  }

  await app.listen(Number(config.get('PORT') ?? 3000));
}

void bootstrap();