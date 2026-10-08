import { ApiProperty, OmitType } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsDateString,
  IsBoolean,
  IsEnum,
  IsUUID,
  IsObject,
  IsArray,
  ArrayNotEmpty,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { VALIDATION_MESSAGES } from '../../common/constants/response-messages.constant';
import { EnrollmentStatus } from '../entities/user-enrollment.entity';

export class CreateEnrollmentDto {

  @ApiProperty({
    description: 'Learner ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: true,
  })
  @IsNotEmpty({ message: VALIDATION_MESSAGES.COMMON.REQUIRED('Learner ID') })
  @IsString({ message: VALIDATION_MESSAGES.COMMON.STRING('Learner ID') })
  learnerId: string;

  @ApiProperty({
    description: 'Course ID or array of Course IDs',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: true,
    type: [String],
  })
  @Transform(({ value }) => Array.isArray(value) ? value : [value])
  @IsArray()
  @IsUUID('4', { each: true, message: VALIDATION_MESSAGES.COMMON.UUID('Course ID') })
  courseId: string[];

  @ApiProperty({
    description: 'Enrollment status',
    example: 'PUBLISHED',
    required: false,
  })
  @IsOptional()
  @IsEnum(EnrollmentStatus, { message: VALIDATION_MESSAGES.COMMON.ENUM('Enrollment status') })
  status?: EnrollmentStatus;  

  @ApiProperty({
    description: 'Enrollment end time',
    example: '2024-12-31T23:59:59Z',
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: VALIDATION_MESSAGES.COMMON.DATE('End time') })
  endTime?: string;

  @ApiProperty({
    description: 'Whether the plan is unlimited',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: VALIDATION_MESSAGES.COMMON.BOOLEAN('Unlimited plan') })
  @Type(() => Boolean)
  unlimitedPlan?: boolean;

  @ApiProperty({
    description: 'Whether to send before expiry mail',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: VALIDATION_MESSAGES.COMMON.BOOLEAN('Before expiry mail') })
  @Type(() => Boolean)
  beforeExpiryMail?: boolean;

  @ApiProperty({
    description: 'Whether to send after expiry mail',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: VALIDATION_MESSAGES.COMMON.BOOLEAN('After expiry mail') })
  @Type(() => Boolean)
  afterExpiryMail?: boolean;

  @ApiProperty({
    description: 'Additional parameters as JSON',
    example: '{"priority": "high", "notes": "VIP student"}',
    required: false,
  })
  @IsOptional()
  @IsObject({ message: VALIDATION_MESSAGES.COMMON.OBJECT('Additional parameters') })
  params?: any;

  @ApiProperty({
    description: 'User who enrolled the student',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsString({ message: VALIDATION_MESSAGES.COMMON.STRING('Enrolled by') })
  enrolledBy?: string;
}

/**
 * Same as CreateEnrollmentDto, but accepts multiple learners:
 * the single `learnerId` is replaced with a `learnerIds` array.
 */
export class CreateMultiUserEnrollmentDto extends OmitType(CreateEnrollmentDto, [
  'learnerId',
] as const) {
  @ApiProperty({
    description: 'Array of Learner IDs',
    example: [
      '123e4567-e89b-12d3-a456-426614174000',
      '223e4567-e89b-12d3-a456-426614174001',
    ],
    required: true,
    type: [String],
  })
  // Trim values and drop duplicates so the same learner is not processed twice
  @Transform(({ value }) =>
    Array.isArray(value)
      ? [...new Set(value.map((id) => (typeof id === 'string' ? id.trim() : id)))]
      : value,
  )
  @IsArray({ message: VALIDATION_MESSAGES.COMMON.ARRAY('Learner IDs') })
  @ArrayNotEmpty({ message: VALIDATION_MESSAGES.COMMON.MIN_ARRAY_LENGTH('Learner IDs', 1) })
  @IsString({ each: true, message: VALIDATION_MESSAGES.COMMON.STRING('Learner ID') })
  learnerIds: string[];
}
