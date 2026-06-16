import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('provider_settings')
export class ProviderSetting {
  @PrimaryColumn()
  provider: string;

  @Column({ default: '' })
  apiKey: string;

  @Column({ default: '' })
  model: string;

  @Column({ default: true })
  enabled: boolean;

  @UpdateDateColumn()
  updatedAt: Date;
}
