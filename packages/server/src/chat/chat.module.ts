import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { ChatSession } from './entities/chat-session.entity.js';
import { ChatMessage } from './entities/chat-message.entity.js';
import { LlmModule } from '../llm/llm.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([ChatSession, ChatMessage]), LlmModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
