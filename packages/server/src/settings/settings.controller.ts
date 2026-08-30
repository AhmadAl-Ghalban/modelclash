import { Controller, Get, Put, Body, Param } from '@nestjs/common';
import { SettingsService } from './settings.service.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  getSettings() {
    return this.settingsService.getSettings();
  }

  @Put()
  updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.updateSettings(dto);
  }

  /**
   * Live model list for one provider, fetched from the provider's own API when
   * a credential exists. Falls back to the bundled catalog and says so.
   */
  @Get('models/:provider')
  listModels(@Param('provider') provider: string) {
    return this.settingsService.listModels(provider);
  }
}
