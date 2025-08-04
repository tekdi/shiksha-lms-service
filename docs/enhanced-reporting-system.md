# Enhanced Reporting System - Design & Implementation

## Overview

This document outlines the enhanced reporting system for the Shiksha LMS that supports dual-approach filtering and pagination for both user service and course/tracking data.

## Architecture

### Dual Approach Strategy

1. **User-First Approach**: When user filters are provided
   - Apply user filters to get filtered users from user service
   - Get course/tracking data for those specific users
   - Combine and return results

2. **Course-First Approach**: When no user filters are provided
   - Apply course/tracking filters to get filtered enrollment/tracking data
   - Extract userIds and get user data for those records
   - Combine and return results

## API Design

### Endpoint
```
POST /api/v1/course/report
```

### Request Body Structure

```json
{
  "courseId": "uuid",
  "cohortId": "uuid",
  "lessonId": "uuid", // optional for lesson-level report
  
  // User filters (optional - if provided, User-First approach)
  "userFilters": {
    "firstName": "string",
    "lastName": "string", 
    "username": "string",
    "email": ["string"],
    "userId": ["uuid"],
    "mobile": "number",
    "gender": "string",
    "status": ["active", "inactive"],
    "country": "string",
    "state": "string",
    "district": "string",
    "block": "string",
    "address": "string",
    "pincode": "string",
    "mobile_country_code": "string",
    "provider": "string",
    "role": "string"
  },
  "userSort": ["field", "ASC|DESC"],
  
  // Course/Tracking filters (optional - if no user filters, Course-First approach)
  "courseFilters": {
    "progress": { "min": 0, "max": 100 },    
  },
  "courseSortBy": "progress|lastAccessedDate",
  "courseOrderBy": "ASC|DESC",
  
  // Pagination (0-500 limit)
  "pagination": {
    "page": 1,
    "limit": 20 // max 500
  }
}
```

### Response Structure

```json
{
  "success": true,
  "data": {
    "items": [
      {
        // User fields
        "userId": "uuid",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com",
        "username": "johndoe",
        "mobile": "9876543210",
        "gender": "male",
        "status": "active",
        "country": "India",
        "state": "Maharashtra",
        "district": "Mumbai",
        "block": "Andheri",
        "address": "123 Main Street",
        "pincode": "400001",
        "mobile_country_code": "+91",
        "provider": "google",
        "role": "teacher",
        
        // Course fields (for course-level report)
        "courseId": "uuid",
        "courseTitle": "Course Title",
        "courseStatus": "active",
        "courseFeatured": true,
        "courseFree": false,
        "courseStartDate": "2024-01-01T00:00:00Z",
        "courseEndDate": "2024-12-31T23:59:59Z",
        
        // Course Track fields
        "noOfLessons": 10,
        "completedLessons": 7,
        "courseTrackStatus": "in_progress",
        "lastAccessedDate": "2024-01-15T10:30:00Z",
        
        // Enrollment fields
        "enrolledDate": "2024-01-01T00:00:00Z",
        // Calculated fields
        "progress": 70
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    },
    "filters": {
      "applied": {
        "userFilters": { "status": ["active"] },
        "courseFilters": { "progress": { "min": 50 } }
      }
    }
  }
}
```

## Implementation Details

### 1. DTOs Structure

#### EnhancedCourseReportDto
```typescript
export class EnhancedCourseReportDto {
  @ApiProperty({ description: 'Course ID', example: 'uuid' })
  @IsUUID()
  courseId: string;

  @ApiProperty({ description: 'Cohort ID', example: 'uuid' })
  @IsUUID()
  cohortId: string;

  @ApiProperty({ description: 'Lesson ID (optional for lesson-level report)', example: 'uuid', required: false })
  @IsOptional()
  @IsUUID()
  lessonId?: string;

  @ApiProperty({ description: 'User filters', required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => UserFiltersDto)
  userFilters?: UserFiltersDto;

  @ApiProperty({ description: 'User sort configuration', required: false })
  @IsOptional()
  @IsArray()
  userSort?: [string, 'ASC' | 'DESC'];

  @ApiProperty({ description: 'Course filters', required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => CourseFiltersDto)
  courseFilters?: CourseFiltersDto;

  @ApiProperty({ description: 'Course sort field', required: false })
  @IsOptional()
  @IsString()
  courseSortBy?: string;

  @ApiProperty({ description: 'Course sort order', required: false })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  courseOrderBy?: 'ASC' | 'DESC';

  @ApiProperty({ description: 'Pagination configuration' })
  @ValidateNested()
  @Type(() => PaginationDto)
  pagination: PaginationDto;
}
```

#### UserFiltersDto
```typescript
export class UserFiltersDto {
  @ApiProperty({ description: 'First name', required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ description: 'Last name', required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ description: 'Username', required: false })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({ description: 'Email addresses', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  email?: string[];

  @ApiProperty({ description: 'User IDs', required: false })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  userId?: string[];

  @ApiProperty({ description: 'Mobile number', required: false })
  @IsOptional()
  @IsNumber()
  mobile?: number;

  @ApiProperty({ description: 'Gender', required: false })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiProperty({ description: 'Status', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  status?: string[];

  @ApiProperty({ description: 'Country', required: false })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({ description: 'State', required: false })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ description: 'District', required: false })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiProperty({ description: 'Block', required: false })
  @IsOptional()
  @IsString()
  block?: string;

  @ApiProperty({ description: 'Address', required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ description: 'Pincode', required: false })
  @IsOptional()
  @IsString()
  pincode?: string;

  @ApiProperty({ description: 'Mobile country code', required: false })
  @IsOptional()
  @IsString()
  mobile_country_code?: string;

  @ApiProperty({ description: 'Provider', required: false })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiProperty({ description: 'Role', required: false })
  @IsOptional()
  @IsString()
  role?: string;
}
```

#### CourseFiltersDto
```typescript
export class CourseFiltersDto {
  @ApiProperty({ description: 'Progress range', required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProgressRangeDto)
  progress?: ProgressRangeDto;

  @ApiProperty({ description: 'Status', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  status?: string[];

  @ApiProperty({ description: 'Last accessed date range', required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => DateRangeDto)
  lastAccessedDate?: DateRangeDto;

  @ApiProperty({ description: 'Enrollment status', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enrollmentStatus?: string[];

  @ApiProperty({ description: 'Completion status', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  completionStatus?: string[];
}
```

#### PaginationDto
```typescript
export class PaginationDto {
  @ApiProperty({ description: 'Page number', example: 1 })
  @IsNumber()
  @Min(1)
  page: number;

  @ApiProperty({ description: 'Items per page', example: 20 })
  @IsNumber()
  @Min(1)
  @Max(500)
  limit: number;
}
```

### 2. Service Methods

#### Main Entry Point
```typescript
async generateEnhancedReport(
  reportDto: EnhancedCourseReportDto,
  tenantId: string,
  organisationId: string,
  authorization: string
): Promise<EnhancedReportResponseDto> {
  
  // Validate pagination limits
  const limit = Math.min(reportDto.pagination.limit, 500);
  const offset = (reportDto.pagination.page - 1) * limit;
  
  // Determine approach
  if (reportDto.userFilters && Object.keys(reportDto.userFilters).length > 0) {
    return this.userFirstApproach(reportDto, tenantId, organisationId, authorization, limit, offset);
  } else {
    return this.courseFirstApproach(reportDto, tenantId, organisationId, authorization, limit, offset);
  }
}
```

#### User-First Approach (Two-Phase Pagination)
```typescript
private async userFirstApproach(
  reportDto: EnhancedCourseReportDto,
  tenantId: string,
  organisationId: string,
  authorization: string,
  limit: number,
  offset: number
): Promise<EnhancedReportResponseDto> {
  
  // Phase 1: Get all users matching filter (without pagination)
  const allUsers = await this.getAllFilteredUsers(reportDto.userFilters, authorization);
  
  // Phase 2: Get course data for all users
  const userIds = allUsers.map(u => u.userId);
  const allCourseData = await this.getCourseDataForUsers(
    userIds, 
    reportDto.courseId, 
    reportDto.lessonId,
    tenantId, 
    organisationId,
    reportDto.courseFilters,
    reportDto.courseSortBy,
    reportDto.courseOrderBy
  );
  
  // Phase 3: Combine and then paginate
  const combinedData = this.combineUserAndCourseData(allUsers, allCourseData);
  
  // Apply pagination to combined results
  const startIndex = offset;
  const endIndex = startIndex + limit;
  const paginatedItems = combinedData.slice(startIndex, endIndex);
  
  return {
    success: true,
    data: {
      items: paginatedItems,
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit,
        total: combinedData.length, // Total enrolled users
        totalPages: Math.ceil(combinedData.length / limit)
      },
      filters: {
        applied: {
          userFilters: reportDto.userFilters,
          courseFilters: reportDto.courseFilters
        }
      }
    }
  };
}

// Alternative: Iterative Approach for Large Datasets
private async userFirstApproachIterative(
  reportDto: EnhancedCourseReportDto,
  tenantId: string,
  organisationId: string,
  authorization: string,
  limit: number,
  offset: number
): Promise<EnhancedReportResponseDto> {
  
  let allUsers: any[] = [];
  let enrolledUsers: any[] = [];
  let currentOffset = 0;
  const batchSize = 50; // Fetch users in batches
  
  // Keep fetching users until we have enough enrolled users
  while (enrolledUsers.length < limit && allUsers.length < 1000) { // Safety limit
    const userBatch = await this.getFilteredUsers({
      limit: batchSize,
      offset: currentOffset,
      filters: reportDto.userFilters,
      sort: reportDto.userSort || ["firstName", "ASC"],
      includeCustomFields: true
    }, authorization);
    
    if (userBatch.length === 0) break; // No more users
    
    allUsers.push(...userBatch);
    
    // Check which users are enrolled
    const userIds = userBatch.map(u => u.userId);
    const courseData = await this.getCourseDataForUsers(
      userIds, 
      reportDto.courseId, 
      reportDto.lessonId,
      tenantId, 
      organisationId,
      reportDto.courseFilters,
      reportDto.courseSortBy,
      reportDto.courseOrderBy
    );
    
    // Add enrolled users to result
    for (const user of userBatch) {
      const userCourseData = courseData.filter(c => c.userId === user.userId);
      if (userCourseData.length > 0) {
        enrolledUsers.push(...this.combineUserAndCourseData([user], userCourseData));
      }
    }
    
    currentOffset += batchSize;
  }
  
  // Apply pagination to enrolled users
  const startIndex = offset;
  const endIndex = startIndex + limit;
  const paginatedItems = enrolledUsers.slice(startIndex, endIndex);
  
  return {
    success: true,
    data: {
      items: paginatedItems,
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit,
        total: enrolledUsers.length, // Total enrolled users
        totalPages: Math.ceil(enrolledUsers.length / limit)
      },
      filters: {
        applied: {
          userFilters: reportDto.userFilters,
          courseFilters: reportDto.courseFilters
        }
      }
    }
  };
}
```

#### Course-First Approach
```typescript
private async courseFirstApproach(
  reportDto: EnhancedCourseReportDto,
  tenantId: string,
  organisationId: string,
  authorization: string,
  limit: number,
  offset: number
): Promise<EnhancedReportResponseDto> {
  
  // 1. Get filtered course/tracking data
  const courseData = await this.getFilteredCourseData(
    reportDto.courseId,
    reportDto.lessonId,
    tenantId,
    organisationId,
    reportDto.courseFilters,
    reportDto.courseSortBy,
    reportDto.courseOrderBy,
    limit,
    offset
  );
  
  // 2. Get user data for these course records
  const userIds = [...new Set(courseData.map(c => c.userId))];
  const users = await this.getUsersByIds(userIds, authorization);
  
  // 3. Combine data
  return this.combineCourseAndUserData(courseData, users, limit, offset);
}
```

### 3. User Service Integration

#### Get Filtered Users
```typescript
private async getFilteredUsers(userServiceRequest: any, authorization: string) {
  try {
    const response = await axios.post(`${this.middlewareUrl}/users/search`, userServiceRequest, {
      headers: { Authorization: authorization }
    });
    
    return response.data.result?.getUserDetails || [];
  } catch (error) {
    this.logger.error('Failed to fetch filtered users from external API', error);
    throw new BadRequestException(RESPONSE_MESSAGES.FAILED_TO_FETCH_USER_DATA);
  }
}
```

#### Get Users by IDs
```typescript
private async getUsersByIds(userIds: string[], authorization: string) {
  if (userIds.length === 0) return [];
  
  try {
    const response = await axios.post(`${this.middlewareUrl}/users/search`, {
      limit: userIds.length,
      offset: 0,
      filters: { userId: userIds },
      includeCustomFields: true
    }, {
      headers: { Authorization: authorization }
    });
    
    return response.data.result?.getUserDetails || [];
  } catch (error) {
    this.logger.error('Failed to fetch users by IDs from external API', error);
    throw new BadRequestException(RESPONSE_MESSAGES.FAILED_TO_FETCH_USER_DATA);
  }
}
```

### 4. Database Queries

#### Get Course Data for Users
```typescript
private async getCourseDataForUsers(
  userIds: string[],
  courseId: string,
  lessonId?: string,
  tenantId?: string,
  organisationId?: string,
  filters?: CourseFiltersDto,
  sortBy?: string,
  orderBy?: string
) {
  if (lessonId) {
    // Lesson-level query with user filter
    return this.lessonTrackRepository
      .createQueryBuilder('lessonTrack')
      .innerJoinAndSelect('lessonTrack.course', 'course')
      .leftJoin('user_enrollments', 'enrollment', 
        'enrollment.courseId = lessonTrack.courseId AND enrollment.userId = lessonTrack.userId')
      .where('lessonTrack.lessonId = :lessonId', { lessonId })
      .andWhere('lessonTrack.courseId = :courseId', { courseId })
      .andWhere('lessonTrack.userId IN (:...userIds)', { userIds })
      .andWhere('lessonTrack.tenantId = :tenantId', { tenantId })
      .andWhere(this.buildFilterConditions(filters))
      .orderBy(this.getSortField(sortBy, false), orderBy?.toUpperCase() || 'DESC')
      .getMany();
  } else {
    // Course-level query with user filter
    return this.courseTrackRepository
      .createQueryBuilder('courseTrack')
      .innerJoinAndSelect('courseTrack.course', 'course')
      .leftJoin('user_enrollments', 'enrollment',
        'enrollment.courseId = courseTrack.courseId AND enrollment.userId = courseTrack.userId')
      .where('courseTrack.courseId = :courseId', { courseId })
      .andWhere('courseTrack.userId IN (:...userIds)', { userIds })
      .andWhere('courseTrack.tenantId = :tenantId', { tenantId })
      .andWhere(this.buildFilterConditions(filters))
      .orderBy(this.getSortField(sortBy, true), orderBy?.toUpperCase() || 'DESC')
      .getMany();
  }
}
```

#### Get Filtered Course Data
```typescript
private async getFilteredCourseData(
  courseId: string,
  lessonId?: string,
  tenantId?: string,
  organisationId?: string,
  filters?: CourseFiltersDto,
  sortBy?: string,
  orderBy?: string,
  limit?: number,
  offset?: number
) {
  if (lessonId) {
    // Lesson-level query with filters
    return this.lessonTrackRepository
      .createQueryBuilder('lessonTrack')
      .innerJoinAndSelect('lessonTrack.course', 'course')
      .leftJoin('user_enrollments', 'enrollment',
        'enrollment.courseId = lessonTrack.courseId AND enrollment.userId = lessonTrack.userId')
      .where('lessonTrack.lessonId = :lessonId', { lessonId })
      .andWhere('lessonTrack.courseId = :courseId', { courseId })
      .andWhere('lessonTrack.tenantId = :tenantId', { tenantId })
      .andWhere(this.buildFilterConditions(filters))
      .orderBy(this.getSortField(sortBy, false), orderBy?.toUpperCase() || 'DESC')
      .skip(offset || 0)
      .take(limit || 20)
      .getMany();
  } else {
    // Course-level query with filters
    return this.courseTrackRepository
      .createQueryBuilder('courseTrack')
      .innerJoinAndSelect('courseTrack.course', 'course')
      .leftJoin('user_enrollments', 'enrollment',
        'enrollment.courseId = courseTrack.courseId AND enrollment.userId = courseTrack.userId')
      .where('courseTrack.courseId = :courseId', { courseId })
      .andWhere('courseTrack.tenantId = :tenantId', { tenantId })
      .andWhere(this.buildFilterConditions(filters))
      .orderBy(this.getSortField(sortBy, true), orderBy?.toUpperCase() || 'DESC')
      .skip(offset || 0)
      .take(limit || 20)
      .getMany();
  }
}
```

### 5. Filter Building Helper

```typescript
private buildFilterConditions(filters: CourseFiltersDto): string {
  const conditions: string[] = [];
  
  if (filters?.progress) {
    if (filters.progress.min !== undefined) {
      conditions.push('courseTrack.completedLessons >= :minProgress');
    }
    if (filters.progress.max !== undefined) {
      conditions.push('courseTrack.completedLessons <= :maxProgress');
    }
  }
  
  if (filters?.status) {
    conditions.push('courseTrack.status IN (:...statuses)');
  }
  
  if (filters?.lastAccessedDate) {
    if (filters.lastAccessedDate.from) {
      conditions.push('courseTrack.lastAccessedDate >= :fromDate');
    }
    if (filters.lastAccessedDate.to) {
      conditions.push('courseTrack.lastAccessedDate <= :toDate');
    }
  }
  
  if (filters?.enrollmentStatus) {
    conditions.push('enrollment.status IN (:...enrollmentStatuses)');
  }
  
  if (filters?.completionStatus) {
    conditions.push('courseTrack.status IN (:...completionStatuses)');
  }
  
  return conditions.length > 0 ? conditions.join(' AND ') : '1=1';
}
```

### 6. Data Combination Methods

#### Combine User and Course Data
```typescript
private combineUserAndCourseData(
  users: any[],
  courseData: any[],
  limit: number,
  offset: number
): EnhancedReportResponseDto {
  const combinedItems: any[] = [];
  
  for (const user of users) {
    const userCourseData = courseData.filter(c => c.userId === user.userId);
    
    for (const courseRecord of userCourseData) {
      const progress = courseRecord.noOfLessons > 0 
        ? Math.round((courseRecord.completedLessons / courseRecord.noOfLessons) * 100)
        : 0;
      
      combinedItems.push({
        ...user,
        courseId: courseRecord.course.courseId,
        courseTitle: courseRecord.course.title,
        courseStatus: courseRecord.course.status,
        courseFeatured: courseRecord.course.featured,
        courseFree: courseRecord.course.free,
        courseStartDate: courseRecord.course.startDatetime?.toISOString(),
        courseEndDate: courseRecord.course.endDatetime?.toISOString(),
        courseTrackId: courseRecord.courseTrackId,
        courseTrackStartDate: courseRecord.startDatetime?.toISOString(),
        courseTrackEndDate: courseRecord.endDatetime?.toISOString(),
        noOfLessons: courseRecord.noOfLessons || 0,
        completedLessons: courseRecord.completedLessons || 0,
        courseTrackStatus: courseRecord.status,
        lastAccessedDate: courseRecord.lastAccessedDate?.toISOString(),
        enrollmentId: courseRecord.enrollment?.enrollmentId,
        enrollmentStatus: courseRecord.enrollment?.status,
        enrolledDate: courseRecord.enrollment?.enrolledAt?.toISOString(),
        completedDate: courseRecord.enrollment?.endTime?.toISOString(),
        progress
      });
    }
  }
  
  return {
    success: true,
    data: {
      items: combinedItems,
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit,
        total: combinedItems.length,
        totalPages: Math.ceil(combinedItems.length / limit)
      },
      filters: {
        applied: {
          userFilters: users.length > 0 ? { applied: true } : {},
          courseFilters: courseData.length > 0 ? { applied: true } : {}
        }
      }
    }
  };
}
```

## Pagination Challenges & Solutions

### The Problem
In User-First approach, there's a critical pagination issue:
1. Frontend requests 20 users with filter
2. User service returns 20 users (total: 100 users match filter)
3. LMS finds only 10 out of 20 users are enrolled in the course
4. **Result**: Frontend gets 10 items instead of 20, but pagination shows 100 total users

### Solutions

#### Solution 1: Two-Phase Pagination (Recommended)
- **Phase 1**: Get all users matching filter (without pagination)
- **Phase 2**: Get course data for all users
- **Phase 3**: Combine and then apply pagination
- **Pros**: Accurate pagination, complete data
- **Cons**: Higher memory usage for large datasets

#### Solution 2: Iterative User Fetching
- Fetch users in batches until enough enrolled users are found
- Apply pagination to enrolled users only
- **Pros**: Memory efficient, accurate pagination
- **Cons**: Multiple API calls, slower for large datasets

#### Solution 3: Hybrid Approach
- Estimate enrollment rate to determine how many users to fetch
- Fetch estimated users and apply pagination
- **Pros**: Balanced performance and accuracy
- **Cons**: Requires enrollment rate estimation

### Implementation Choice
- **Small datasets (< 1000 users)**: Use Two-Phase Pagination
- **Large datasets (> 1000 users)**: Use Iterative Approach
- **Production with known patterns**: Use Hybrid Approach

## Performance Considerations

### 1. Database Indexes
```sql
-- User enrollments indexes
CREATE INDEX idx_user_enrollments_course_user ON user_enrollments(courseId, userId);
CREATE INDEX idx_user_enrollments_tenant_org ON user_enrollments(tenantId, organisationId);
CREATE INDEX idx_user_enrollments_status ON user_enrollments(status);

-- Course track indexes
CREATE INDEX idx_course_track_course_user ON course_track(courseId, userId);
CREATE INDEX idx_course_track_tenant_org ON course_track(tenantId, organisationId);
CREATE INDEX idx_course_track_status ON course_track(status);
CREATE INDEX idx_course_track_last_accessed ON course_track(lastAccessedDate);
CREATE INDEX idx_course_track_completed_lessons ON course_track(completedLessons);

-- Lesson track indexes
CREATE INDEX idx_lesson_track_lesson_user ON lesson_track(lessonId, userId);
CREATE INDEX idx_lesson_track_course_user ON lesson_track(courseId, userId);
CREATE INDEX idx_lesson_track_tenant_org ON lesson_track(tenantId, organisationId);
CREATE INDEX idx_lesson_track_status ON lesson_track(status);
CREATE INDEX idx_lesson_track_completion ON lesson_track(completionPercentage);
CREATE INDEX idx_lesson_track_time_spent ON lesson_track(timeSpent);
```

### 2. Query Optimization
- Use `INNER JOIN` for required relationships
- Use `LEFT JOIN` for optional relationships
- Apply filters early in the query chain
- Use proper indexing for sort fields
- Limit result sets with pagination

### 3. External API Optimization
- Batch user ID requests when possible
- Handle partial failures gracefully
- Implement retry logic for transient failures
- Log performance metrics for monitoring

## Error Handling

### 1. Validation Errors
- Invalid filter combinations
- Pagination limit violations
- Missing required fields

### 2. External Service Errors
- User service unavailable
- Invalid authorization token
- Rate limiting

### 3. Database Errors
- Connection failures
- Query timeouts
- Constraint violations

## Testing Strategy

### 1. Unit Tests
- Filter building logic
- Data combination methods
- Pagination calculations

### 2. Integration Tests
- User service integration
- Database query performance
- End-to-end report generation

### 3. Performance Tests
- Large dataset handling
- Concurrent request processing
- Memory usage optimization

## Migration Plan

### Phase 1: DTOs and Basic Structure
1. Create enhanced DTOs
2. Update controller to accept POST requests
3. Implement basic service structure

### Phase 2: User-First Approach
1. Implement user service integration
2. Add user filtering logic
3. Create data combination methods

### Phase 3: Course-First Approach
1. Implement course filtering logic
2. Add database query optimization
3. Complete data combination

### Phase 4: Testing and Optimization
1. Add comprehensive tests
2. Implement performance monitoring
3. Add database indexes

## Future Enhancements

### 1. Advanced Filtering
- Date range filters
- Complex boolean logic
- Custom field filtering

### 2. Export Functionality
- CSV export
- PDF reports
- Scheduled report generation

### 3. Caching Strategy
- User data caching
- Report result caching
- Filter result caching

### 4. Real-time Updates
- WebSocket notifications
- Progress tracking
- Live report updates 