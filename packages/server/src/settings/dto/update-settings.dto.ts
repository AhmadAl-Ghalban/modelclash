import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';

export class ProviderSettingItemDto {
  @IsString()
  provider: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsString()
  model: string;

  @IsBoolean()
  enabled: boolean;
}

export class UpdateSettingsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProviderSettingItemDto)
  settings: ProviderSettingItemDto[];
}
