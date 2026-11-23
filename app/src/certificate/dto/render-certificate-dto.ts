import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

// The global ValidationPipe runs with whitelist: true, which strips every property without a
// class-validator decorator, so both fields must be decorated to reach the controller.
export class RenderCertificateDTO {
  @ApiProperty({ description: 'Credential id (did:rcw:...)' })
  @IsString()
  @IsNotEmpty()
  credentialId: string;

  @ApiProperty({ description: 'Certificate template id' })
  @IsString()
  @IsNotEmpty()
  templateId: string;

  constructor(credentialId: string, templateId: string) {
    this.credentialId = credentialId;
    this.templateId = templateId;
  }
}
