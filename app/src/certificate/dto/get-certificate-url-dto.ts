import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetCertificateUrlDto {
  @ApiProperty({
    description: 'Certificate ID to retrieve URL for',
    example: 'did:rcw:0fd010b3-ef60-4918-99ae-d87fdb60c532',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  certificateId: string;
}

