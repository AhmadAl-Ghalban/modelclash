import { Module } from '@nestjs/common';
import { LlmService } from './llm.service.js';
import { SettingsModule } from '../settings/settings.module.js';

@Module({
  imports: [SettingsModule],
  providers: [LlmService],
  exports: [LlmService],
})
export class LlmModule {}
