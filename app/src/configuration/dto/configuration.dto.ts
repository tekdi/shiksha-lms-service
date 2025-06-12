import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsObject, IsOptional } from 'class-validator';

export class ConfigDto {
    @ApiProperty({
    description: 'Configuration data',
    example: {
      "featureFlags": {
        "enableNewUI": true
      },
      "settings": {
        "maxFileSize": 10485760
      }
    }
  })
  @IsObject()
  @IsOptional()
  config: Record<string, any>;
} 