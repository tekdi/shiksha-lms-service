import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty } from 'class-validator';

export class CommonQueryDto {
  @ApiProperty({
    description: 'User ID',
    format: 'string',
    required: true
  })
  @IsNotEmpty({ message: "User ID is required field" })
  // @IsUUID('4', { message: "User ID must be a valid UUID" })
  userId: string;
} 