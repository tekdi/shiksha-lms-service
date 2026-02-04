import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsString } from 'class-validator';

export class AggregationDto {
    @ApiProperty({
        description: 'Associated cohort ID',
        example: '123e4567-e89b-12d3-a456-426614174001',
        type: 'string',
        format: 'uuid'
    })
    @IsUUID()
    cohortId: string;

    @ApiProperty({
        description: 'Filter parameters for content type (e.g., event)',
        example: 'event',
        type: 'string',
        required: false
    })
    @IsOptional()
    @IsString()
    contentType?: string;
}

export class ContentDetailDto {
    @ApiProperty()
    lessonId: string;

    @ApiProperty()
    title: string;

    @ApiProperty()
    format: string;

    @ApiProperty()
    subFormat: string;

    @ApiProperty({ required: false })
    media?: any;
}

export class UnitDetailDto {
    @ApiProperty()
    unitId: string;

    @ApiProperty()
    title: string;

    @ApiProperty({ type: [ContentDetailDto] })
    contents: ContentDetailDto[];
}

export class AggregatedCourseResponseDto {
    @ApiProperty()
    courseId: string;

    @ApiProperty()
    title: string;

    @ApiProperty({ type: [UnitDetailDto] })
    units: UnitDetailDto[];
}

export class AggregatedResponseDto {
    @ApiProperty({ type: [AggregatedCourseResponseDto] })
    modules: AggregatedCourseResponseDto[];
}

export class AggregationHeadersDto {
    @ApiProperty({
        description: 'Authentication token for external API calls',
        example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        type: 'string'
    })
    @IsString()
    authorization: string;
}
