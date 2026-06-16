import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatModule } from './chat/chat.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { LlmModule } from './llm/llm.module.js';
import { ChatSession } from './chat/entities/chat-session.entity.js';
import { ChatMessage } from './chat/entities/chat-message.entity.js';
import { ProviderSetting } from './settings/entities/provider-setting.entity.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [ChatSession, ChatMessage, ProviderSetting],
        synchronize: true,
        logging: false,
      }),
    }),
    ChatModule,
    SettingsModule,
    LlmModule,
  ],
})
export class AppModule {}
