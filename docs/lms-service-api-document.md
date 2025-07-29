# Shiksha LMS API Documentation

## Table of Contents 📑

1. [Overview](#overview)
   - [Base URL and Authentication](#base-url-and-authentication)
   - [Common Response Format](#common-response-format)
   - [Error Handling](#error-handling)

2. [Health](#health)
   - [Health Check](#health-check)

3. [Configuration](#configuration)
   - [Get LMS Configuration](#get-lms-configuration)
   - [Sync Configuration](#sync-configuration)

4. [Courses](#courses)
   - [Create Course](#create-course)
   - [Get All Courses](#get-all-courses)
   - [Search Courses](#search-courses)
   - [Get Course by ID](#get-course-by-id)
   - [Update Course](#update-course)
   - [Delete Course](#delete-course)
   - [Get Course Hierarchy with Tracking](#get-course-hierarchy-with-tracking)

5. [Modules](#modules)
   - [Create Module](#create-module)
   - [Get All Modules](#get-all-modules)
   - [Get Module by ID](#get-module-by-id)
   - [Update Module](#update-module)
   - [Delete Module](#delete-module)

6. [Lessons](#lessons)
   - [Create Lesson](#create-lesson)
   - [Get All Lessons](#get-all-lessons)
   - [Get Lesson by ID](#get-lesson-by-id)
   - [Get Lessons by Module](#get-lessons-by-module)
   - [Update Lesson](#update-lesson)
   - [Delete Lesson](#delete-lesson)

7. [Media](#media)
   - [Upload Media](#upload-media)
   - [Get Media List](#get-media-list)
   - [Get Media by ID](#get-media-by-id)
   - [Associate Media with Lesson](#associate-media-with-lesson)
   - [Delete Media](#delete-media)
   - [Remove Media Association](#remove-media-association)

8. [Enrollments](#enrollments)
   - [Enroll User](#enroll-user)
   - [Get User Enrollments](#get-user-enrollments)
   - [Get Enrollment by ID](#get-enrollment-by-id)
   - [Update Enrollment](#update-enrollment)
   - [Cancel Enrollment](#cancel-enrollment)

9. [Tracking](#tracking)
   - [Get Course Tracking](#get-course-tracking)
   - [Start Lesson Attempt](#start-lesson-attempt)
   - [Manage Lesson Attempt](#manage-lesson-attempt)
   - [Get Lesson Status](#get-lesson-status)
   - [Get Attempt Details](#get-attempt-details)
   - [Update Attempt Progress](#update-attempt-progress)

## Overview

The Shiksha LMS API is a comprehensive Learning Management System microservice built with NestJS. It provides endpoints for managing courses, modules, lessons, media, enrollments, and learning progress tracking with multi-tenancy support.

**Base URL**: `http://localhost:4000/lms-service/v1`

**API Version**: v1

**Content-Type**: `application/json` (except for file uploads which use `multipart/form-data`)

## Base URL and Authentication

- **Base URL**: `http://localhost:4000/lms-service/v1`
- **Authentication**: Multi-tenant header-based authentication
- **Required Headers**: All endpoints require tenant and organization context via headers

### Required Headers

All API requests must include the following headers:

```
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Example:**
```
tenantid: 123e4567-e89b-12d3-a456-426614174000
organisationid: 456e7890-e89b-12d3-a456-426614174000
```

## Common Response Format

All API responses follow a standardized format with the following structure:

```json
{
  "id": "api.course.create",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 201,
  "result": {
    // Response data here
  }
}
```

### Response Structure Details:

- **id**: API identifier (e.g., "api.course.create", "api.module.read")
- **ver**: API version (always "1.0")
- **ts**: Timestamp of the response
- **params**: Response metadata
  - **resmsgid**: Unique message ID
  - **status**: "successful" or "failed"
  - **err**: Error code (null if successful)
  - **errmsg**: Error message (null if successful)
- **responseCode**: HTTP status code
- **result**: Actual response data

## Error Handling

Error responses follow this format:

```json
{
  "id": "api.course.create",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "failed",
    "err": "VALIDATION_ERROR",
    "errmsg": "Invalid input data"
  },
  "responseCode": 400,
  "result": {
    "errors": [
      {
        "field": "email",
        "message": "Invalid email format",
        "code": "INVALID_FORMAT"
      }
    ]
  }
}
```

## API Endpoints

### Health Check

#### Get System Health

**Endpoint**: `GET /health`

**HTTP Method**: GET

**Description**: Check the health status of the system and database connectivity

**Headers**:
```
Content-Type: application/json
```

**Response Structure**:
```json
{
  "id": "api.health.check",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "status": "ok",
    "uptime": 12345.67,
    "timestamp": 1703123456789,
    "db": "connected"
  }
}
```

**Validations and Conditions**:

**Input Validation Rules**:
- No input parameters required
- No request body validation needed

**Business Logic Conditions**:
- System must be running and accessible
- Database connection must be established
- All required services must be healthy
- Uptime calculation must be accurate
- Timestamp must be in ISO format

**Status Codes**:
- `200 OK`: System is healthy
- `500 Internal Server Error`: System health check failed

---

### Configuration

#### Get LMS Configuration

**Endpoint**: `GET /config`

**HTTP Method**: GET

**Description**: Retrieve LMS configuration for the current tenant

**Headers**:
```
Content-Type: application/json
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Response Structure**:
```json
{
  "id": "api.config.get",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "configuration": {
      "features": {
        "certificates": true,
        "badges": true,
        "assessments": true
      },
      "settings": {
        "maxFileSize": 10485760,
        "allowedFormats": ["mp4", "pdf", "docx"]
      }
    }
  }
}
```

**Validations and Conditions**:

**Input Validation Rules**:
- `tenantid` header must be present and valid UUID format
- `organisationid` header must be present and valid UUID format
- Headers must not be empty or null

**Business Logic Conditions**:
- Tenant must exist in the system
- Organization must be associated with the tenant
- Configuration must be available for the tenant
- If tenant configuration is not found, return default configuration
- Configuration must be cached for performance
- Feature flags must be properly evaluated

**Authorization Conditions**:
- User must have access to the specified tenant
- User must have read permissions for configuration

#### Sync Configuration

**Endpoint**: `POST /config/sync`

**HTTP Method**: POST

**Description**: Sync configuration from external service

**Headers**:
```
Content-Type: application/json
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Response Structure**:
```json
{
  "id": "api.config.sync",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "message": "Configuration synced successfully"
  }
}
```

**Validations and Conditions**:

**Input Validation Rules**:
- `tenantid` header must be present and valid UUID format
- `organisationid` header must be present and valid UUID format
- Headers must not be empty or null

**Business Logic Conditions**:
- Tenant must exist in the system
- External configuration service must be accessible
- Sync operation must be idempotent
- Configuration changes must be atomic
- If sync fails, previous configuration must be preserved
- Sync must be logged for audit purposes
- Rate limiting applies to prevent excessive sync requests

**Authorization Conditions**:
- User must have admin permissions for the tenant
- User must have write permissions for configuration
- Sync operation requires elevated privileges

---

### Courses

#### Create Course

**Endpoint**: `POST /courses`

**HTTP Method**: POST

**Content-Type**: `multipart/form-data`

**Description**: Create a new course with optional image upload

**Headers**:
```
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Request Parameters**:
- `title` (string, required): Course title (max 255 characters)
- `alias` (string, optional): Course alias/slug
- `startDatetime` (string, required): Course start date (ISO format)
- `endDatetime` (string, required): Course end date (ISO format)
- `shortDescription` (string, required): Brief description
- `description` (string, required): Detailed description
- `image` (file, optional): Course thumbnail image
- `featured` (boolean, optional): Whether course is featured (default: false)
- `free` (boolean, optional): Whether course is free (default: false)
- `status` (enum, optional): Course status - 'published', 'unpublished', 'archived' (default: 'unpublished')
- `adminApproval` (boolean, optional): Require admin approval (default: false)
- `autoEnroll` (boolean, optional): Enable auto-enrollment (default: false)
- `certificateTerm` (object, optional): Certificate configuration
- `rewardType` (enum, optional): Reward type - 'certificate', 'badge'
- `templateId` (UUID, optional): Template ID for rewards
- `prerequisites` (array, optional): Array of prerequisite course IDs
- `params` (object, optional): Additional parameters (JSON object)

**Query Parameters**:
- `userId` (UUID, required): User ID creating the course

**Response Structure**:
```json
{
  "id": "api.course.create",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 201,
  "result": {
    "courseId": "123e4567-e89b-12d3-a456-426614174000",
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "organisationId": "456e7890-e89b-12d3-a456-426614174000",
    "title": "Introduction to Web Development",
    "alias": "intro-web-dev",
    "shortDescription": "A brief intro to web development",
    "description": "Learn the fundamentals of web development",
    "image": "/uploads/courses/course-thumb.jpg",
    "featured": false,
    "free": false,
    "certificateTerm": null,
    "rewardType": "certificate",
    "templateId": null,
    "prerequisites": [],
    "startDatetime": "2024-01-01T00:00:00Z",
    "endDatetime": "2024-12-31T23:59:59Z",
    "adminApproval": false,
    "autoEnroll": false,
    "status": "unpublished",
    "params": null,
    "createdBy": "789e0123-e89b-12d3-a456-426614174000",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedBy": "789e0123-e89b-12d3-a456-426614174000",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

**Validations and Conditions**:

**Input Validation Rules**:
- `title` must be present, non-empty, and max 255 characters
- `startDatetime` must be present and valid date format
- `endDatetime` must be valid date format and after startDatetime (if provided)
- `shortDescription` must be present and string type
- `description` must be present, non-empty, and string type
- `alias` must be unique within the tenant (if provided, auto-generated if not)
- `image` file must be valid image format and within tenant-configured size limits (if provided)
- `featured` must be boolean value (default: false)
- `free` must be boolean value (default: false)
- `status` must be one of: 'published', 'unpublished', 'archived' (default: 'unpublished')
- `adminApproval` must be boolean value (default: false)
- `autoEnroll` must be boolean value (default: false)
- `rewardType` must be one of: 'certificate', 'badge' (if provided)
- `templateId` must be valid UUID format (if provided)
- `prerequisites` must be array of valid UUIDs (if provided)
- `params` must be valid JSON object (if provided)
- `userId` query parameter must be present and valid UUID

**Business Logic Conditions**:
- Course alias must be unique within the tenant (auto-generated if not provided)
- If course is published, all required fields must be completed
- If adminApproval is true, course status must be 'unpublished'
- If autoEnroll is true, course must be free or have proper enrollment rules
- If prerequisites are specified, all prerequisite courses must exist
- If templateId is provided, template must exist and be accessible
- Image upload must be processed and stored securely according to tenant configuration
- Course creation must be atomic (all-or-nothing)
- Audit trail must be maintained for course creation

**Authorization Conditions**:
- User must have create permissions for courses in the tenant
- User must have access to the specified organization
- If creating featured course, user must have admin privileges
- If setting adminApproval, user must have admin permissions

#### Search Courses

**Endpoint**: `GET /courses/search`

**HTTP Method**: GET

**Description**: Search and filter courses with various criteria

**Headers**:
```
Content-Type: application/json
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Query Parameters**:
- `query` (string, optional): Search keyword to match in title, description, or short description
- `cohortId` (string, optional): Filter by cohort ID
- `status` (enum, optional): Filter by course status - 'published', 'unpublished', 'archived'
- `featured` (boolean, optional): Filter by featured status
- `free` (boolean, optional): Filter by free/paid status
- `startDateFrom` (string, optional): Filter by start date (from) - ISO date format
- `startDateTo` (string, optional): Filter by start date (to) - ISO date format
- `endDateFrom` (string, optional): Filter by end date (from) - ISO date format
- `endDateTo` (string, optional): Filter by end date (to) - ISO date format
- `createdBy` (UUID, optional): Filter by creator user ID
- `offset` (number, optional): Number of items to skip (default: 0)
- `limit` (number, optional): Number of items to return (default: 10)
- `sortBy` (enum, optional): Field to sort by - 'createdAt', 'updatedAt', 'title', 'startDatetime', 'endDatetime', 'featured', 'free' (default: 'createdAt')
- `orderBy` (enum, optional): Sort order - 'ASC', 'DESC' (default: 'DESC')

**Response Structure**:
```json
{
  "id": "api.course.search",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "courses": [
      {
        "courseId": "123e4567-e89b-12d3-a456-426614174000",
        "tenantId": "123e4567-e89b-12d3-a456-426614174000",
        "organisationId": "456e7890-e89b-12d3-a456-426614174000",
        "title": "Introduction to Web Development",
        "alias": "intro-web-dev",
        "shortDescription": "A brief intro to web development",
        "description": "Learn the fundamentals of web development",
        "image": "/uploads/courses/course-thumb.jpg",
        "featured": false,
        "free": false,
        "certificateTerm": null,
        "rewardType": "certificate",
        "templateId": null,
        "prerequisites": [],
        "startDatetime": "2024-01-01T00:00:00Z",
        "endDatetime": "2024-12-31T23:59:59Z",
        "adminApproval": false,
        "autoEnroll": false,
        "status": "published",
        "params": null,
        "createdBy": "789e0123-e89b-12d3-a456-426614174000",
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedBy": "789e0123-e89b-12d3-a456-426614174000",
        "updatedAt": "2024-01-01T00:00:00Z"
      }
    ],
    "totalElements": 25,
    "offset": 0,
    "limit": 10
  }
}
```

**Validations and Conditions**:

**Input Validation Rules**:
- `tenantid` header must be present and valid UUID format
- `organisationid` header must be present and valid UUID format
- `query` must be string and max 100 characters (if provided)
- `cohortId` must be valid UUID format (if provided)
- `status` must be one of: 'published', 'unpublished', 'archived' (if provided)
- `featured` must be boolean value (if provided)
- `free` must be boolean value (if provided)
- `startDateFrom` must be valid ISO date format (if provided)
- `startDateTo` must be valid ISO date format and after startDateFrom (if provided)
- `endDateFrom` must be valid ISO date format (if provided)
- `endDateTo` must be valid ISO date format and after endDateFrom (if provided)
- `createdBy` must be valid UUID format (if provided)
- `offset` must be non-negative integer (default: 0)
- `limit` must be positive integer between 1-100 (default: 10)
- `sortBy` must be one of: 'createdAt', 'updatedAt', 'title', 'startDatetime', 'endDatetime', 'featured', 'free' (default: 'createdAt')
- `orderBy` must be one of: 'ASC', 'DESC' (default: 'DESC')

**Business Logic Conditions**:
- Search results must be filtered by tenant and organization
- If query is provided, search must be performed on title, description, and shortDescription
- Date range filters must be applied correctly
- Pagination must work correctly with offset and limit
- Sorting must be applied before pagination
- Only published courses should be returned for non-admin users
- Featured courses should appear first when featured=true
- Search must be case-insensitive
- Results must be ordered by relevance when query is provided

**Authorization Conditions**:
- User must have read permissions for courses in the tenant
- User must have access to the specified organization
- Admin users can see all courses regardless of status
- Non-admin users can only see published courses

#### Get Course by ID

**Endpoint**: `GET /courses/{courseId}`

**HTTP Method**: GET

**Description**: Retrieve a specific course by its ID

**Headers**:
```
Content-Type: application/json
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Path Parameters**:
- `courseId` (UUID, required): Course ID

**Response Structure**:
```json
{
  "id": "api.course.read",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "courseId": "123e4567-e89b-12d3-a456-426614174000",
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "organisationId": "456e7890-e89b-12d3-a456-426614174000",
    "title": "Introduction to Web Development",
    "alias": "intro-web-dev",
    "shortDescription": "A brief intro to web development",
    "description": "Learn the fundamentals of web development",
    "image": "/uploads/courses/course-thumb.jpg",
    "featured": false,
    "free": false,
    "certificateTerm": null,
    "rewardType": "certificate",
    "templateId": null,
    "prerequisites": [],
    "startDatetime": "2024-01-01T00:00:00Z",
    "endDatetime": "2024-12-31T23:59:59Z",
    "adminApproval": false,
    "autoEnroll": false,
    "status": "published",
    "params": null,
    "createdBy": "789e0123-e89b-12d3-a456-426614174000",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedBy": "789e0123-e89b-12d3-a456-426614174000",
    "updatedAt": "2024-01-01T00:00:00Z",
    "modules": []
  }
}
```

**Validations and Conditions**:

**Input Validation Rules**:
- `tenantid` header must be present and valid UUID format
- `organisationid` header must be present and valid UUID format
- `courseId` path parameter must be present and valid UUID format

**Business Logic Conditions**:
- Course must exist in the system
- Course must belong to the specified tenant and organization
- If course is archived, only admin users can access it
- If course is unpublished, only course creator or admin can access it
- Course data must be cached for performance
- Related modules must be loaded if requested
- Course must be accessible based on user permissions

**Authorization Conditions**:
- User must have read permissions for courses in the tenant
- User must have access to the specified organization
- Admin users can access any course regardless of status
- Non-admin users can only access published courses
- Course creator can access their own courses regardless of status

#### Get Course Hierarchy

**Endpoint**: `GET /courses/{courseId}/hierarchy`

**HTTP Method**: GET

**Description**: Get course structure with modules and lessons

**Headers**:
```
Content-Type: application/json
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Path Parameters**:
- `courseId` (UUID, required): Course ID

**Response Structure**:
```json
{
  "id": "api.course.hierarchy",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "courseId": "123e4567-e89b-12d3-a456-426614174000",
    "title": "Introduction to Web Development",
    "alias": "intro-web-dev",
    "description": "Learn the fundamentals of web development",
    "modules": [
      {
        "moduleId": "456e7890-e89b-12d3-a456-426614174000",
        "parentId": null,
        "courseId": "123e4567-e89b-12d3-a456-426614174000",
        "tenantId": "123e4567-e89b-12d3-a456-426614174000",
        "organisationId": "456e7890-e89b-12d3-a456-426614174000",
        "title": "Module 1: HTML Basics",
        "description": "Learn HTML fundamentals",
        "image": "/uploads/modules/module-thumb.jpg",
        "startDatetime": "2024-01-01T00:00:00Z",
        "endDatetime": "2024-12-31T23:59:59Z",
        "prerequisites": [],
        "badgeTerm": null,
        "badgeId": null,
        "ordering": 1,
        "status": "published",
        "createdAt": "2024-01-01T00:00:00Z",
        "createdBy": "789e0123-e89b-12d3-a456-426614174000",
        "updatedAt": "2024-01-01T00:00:00Z",
        "updatedBy": "789e0123-e89b-12d3-a456-426614174000",
        "lessons": [
          {
            "lessonId": "789e0123-e89b-12d3-a456-426614174000",
            "tenantId": "123e4567-e89b-12d3-a456-426614174000",
            "organisationId": "456e7890-e89b-12d3-a456-426614174000",
            "checkedOut": null,
            "checkedOutTime": null,
            "title": "Introduction to HTML",
            "alias": "intro-html",
            "status": "published",
            "description": "Learn HTML basics",
            "image": "/uploads/lessons/lesson-thumb.jpg",
            "startDatetime": "2024-01-01T00:00:00Z",
            "endDatetime": "2024-12-31T23:59:59Z",
            "storage": "local",
            "noOfAttempts": 1,
            "attemptsGrade": "highest",
            "format": "video",
            "mediaId": "abc12345-e89b-12d3-a456-426614174000",
            "prerequisites": [],
            "idealTime": 30,
            "resume": false,
            "totalMarks": 100,
            "passingMarks": 60,
            "params": null,
            "courseId": "123e4567-e89b-12d3-a456-426614174000",
            "moduleId": "456e7890-e89b-12d3-a456-426614174000",
            "sampleLesson": false,
            "considerForPassing": true,
            "ordering": 1,
            "createdAt": "2024-01-01T00:00:00Z",
            "createdBy": "789e0123-e89b-12d3-a456-426614174000",
            "updatedAt": "2024-01-01T00:00:00Z",
            "updatedBy": "789e0123-e89b-12d3-a456-426614174000"
          }
        ]
      }
    ]
  }
}
```

**Validations and Conditions**:

**Input Validation Rules**:
- `tenantid` header must be present and valid UUID format
- `organisationid` header must be present and valid UUID format
- `courseId` path parameter must be present and valid UUID format

**Business Logic Conditions**:
- Course must exist and be accessible
- Course must belong to the specified tenant and organization
- Only published modules should be included in hierarchy
- Only published lessons should be included in hierarchy
- Modules must be ordered by their ordering field
- Lessons must be ordered by their ordering field within each module
- Hierarchy must be cached for performance
- If course is archived, only admin users can access hierarchy
- If course is unpublished, only course creator or admin can access hierarchy

**Authorization Conditions**:
- User must have read permissions for courses in the tenant
- User must have access to the specified organization
- Admin users can access hierarchy of any course regardless of status
- Non-admin users can only access hierarchy of published courses
- Course creator can access hierarchy of their own courses regardless of status

#### Get Course Hierarchy with Tracking

**Endpoint**: `GET /courses/{courseId}/hierarchy/tracking/{userId}`

**HTTP Method**: GET

**Description**: Get course tracking and eligibility information for a user

**Headers**:
```
Content-Type: application/json
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Path Parameters**:
- `courseId` (UUID, required): Course ID
- `userId` (UUID, required): User ID

**Query Parameters**:
- `includeModules` (boolean, optional): Include modules in the response (default: false)
- `includeLessons` (boolean, optional): Include lessons in the response (default: false)
- `moduleId` (UUID, optional): Module ID to filter lessons for a specific module (required when includeLessons=true)

**Response Structure**:

The response structure varies based on the query parameters:

### **Scenario 1: No Parameters (Course-level only)**
```json
{
  "id": "api.course.tracking",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "courseId": "123e4567-e89b-12d3-a456-426614174000",
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "organisationId": "456e7890-e89b-12d3-a456-426614174000",
    "title": "Introduction to Web Development",
    "alias": "intro-web-dev",
    "shortDescription": "A brief intro to web development",
    "description": "Learn the fundamentals of web development",
    "image": "/uploads/courses/course-thumb.jpg",
    "featured": false,
    "free": false,
    "certificateTerm": null,
    "rewardType": "certificate",
    "templateId": null,
    "prerequisites": [],
    "startDatetime": "2024-01-01T00:00:00Z",
    "endDatetime": "2024-12-31T23:59:59Z",
    "adminApproval": false,
    "autoEnroll": false,
    "status": "published",
    "params": null,
    "createdBy": "789e0123-e89b-12d3-a456-426614174000",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedBy": "789e0123-e89b-12d3-a456-426614174000",
    "updatedAt": "2024-01-01T00:00:00Z",
    "modules": [],
    "tracking": {
      "status": "in_progress",
      "progress": 60,
      "completedLessons": 15,
      "totalLessons": 25,
      "lastAccessed": "2024-01-01T10:30:00Z",
      "timeSpent": 3600,
      "startDatetime": "2024-01-01T09:00:00Z",
      "endDatetime": null
    },
    "lastAccessedLesson": null,
    "eligibility": {
      "requiredCourses": [],
      "isEligible": true
    }
  }
}
```

### **Scenario 2: includeModules=true**
```json
{
  "id": "api.course.tracking",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "courseId": "123e4567-e89b-12d3-a456-426614174000",
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "organisationId": "456e7890-e89b-12d3-a456-426614174000",
    "title": "Introduction to Web Development",
    "alias": "intro-web-dev",
    "shortDescription": "A brief intro to web development",
    "description": "Learn the fundamentals of web development",
    "image": "/uploads/courses/course-thumb.jpg",
    "featured": false,
    "free": false,
    "certificateTerm": null,
    "rewardType": "certificate",
    "templateId": null,
    "prerequisites": [],
    "startDatetime": "2024-01-01T00:00:00Z",
    "endDatetime": "2024-12-31T23:59:59Z",
    "adminApproval": false,
    "autoEnroll": false,
    "status": "published",
    "params": null,
    "createdBy": "789e0123-e89b-12d3-a456-426614174000",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedBy": "789e0123-e89b-12d3-a456-426614174000",
    "updatedAt": "2024-01-01T00:00:00Z",
    "modules": [
      {
        "moduleId": "456e7890-e89b-12d3-a456-426614174000",
        "parentId": null,
        "courseId": "123e4567-e89b-12d3-a456-426614174000",
        "tenantId": "123e4567-e89b-12d3-a456-426614174000",
        "organisationId": "456e7890-e89b-12d3-a456-426614174000",
        "title": "Module 1: HTML Basics",
        "description": "Learn HTML fundamentals",
        "image": "/uploads/modules/module-thumb.jpg",
        "startDatetime": "2024-01-01T00:00:00Z",
        "endDatetime": "2024-12-31T23:59:59Z",
        "prerequisites": [],
        "badgeTerm": null,
        "badgeId": null,
        "ordering": 1,
        "status": "published",
        "createdAt": "2024-01-01T00:00:00Z",
        "createdBy": "789e0123-e89b-12d3-a456-426614174000",
        "updatedAt": "2024-01-01T00:00:00Z",
        "updatedBy": "789e0123-e89b-12d3-a456-426614174000",
        "lessons": [],
        "tracking": {
          "status": "in_progress",
          "progress": 75,
          "completedLessons": 3,
          "totalLessons": 4
        }
      }
    ],
    "tracking": {
      "status": "in_progress",
      "progress": 60,
      "completedLessons": 15,
      "totalLessons": 25,
      "lastAccessed": "2024-01-01T10:30:00Z",
      "timeSpent": 3600,
      "startDatetime": "2024-01-01T09:00:00Z",
      "endDatetime": null
    },
    "lastAccessedLesson": null,
    "eligibility": {
      "requiredCourses": [],
      "isEligible": true
    }
  }
}
```

### **Scenario 3: includeModules=true, includeLessons=true (All modules and lessons)**
```json
{
  "id": "api.course.tracking",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "courseId": "123e4567-e89b-12d3-a456-426614174000",
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "organisationId": "456e7890-e89b-12d3-a456-426614174000",
    "title": "Introduction to Web Development",
    "alias": "intro-web-dev",
    "shortDescription": "A brief intro to web development",
    "description": "Learn the fundamentals of web development",
    "image": "/uploads/courses/course-thumb.jpg",
    "featured": false,
    "free": false,
    "certificateTerm": null,
    "rewardType": "certificate",
    "templateId": null,
    "prerequisites": [],
    "startDatetime": "2024-01-01T00:00:00Z",
    "endDatetime": "2024-12-31T23:59:59Z",
    "adminApproval": false,
    "autoEnroll": false,
    "status": "published",
    "params": null,
    "createdBy": "789e0123-e89b-12d3-a456-426614174000",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedBy": "789e0123-e89b-12d3-a456-426614174000",
    "updatedAt": "2024-01-01T00:00:00Z",
    "modules": [
      {
        "moduleId": "456e7890-e89b-12d3-a456-426614174000",
        "parentId": null,
        "courseId": "123e4567-e89b-12d3-a456-426614174000",
        "tenantId": "123e4567-e89b-12d3-a456-426614174000",
        "organisationId": "456e7890-e89b-12d3-a456-426614174000",
        "title": "Module 1: HTML Basics",
        "description": "Learn HTML fundamentals",
        "image": "/uploads/modules/module-thumb.jpg",
        "startDatetime": "2024-01-01T00:00:00Z",
        "endDatetime": "2024-12-31T23:59:59Z",
        "prerequisites": [],
        "badgeTerm": null,
        "badgeId": null,
        "ordering": 1,
        "status": "published",
        "createdAt": "2024-01-01T00:00:00Z",
        "createdBy": "789e0123-e89b-12d3-a456-426614174000",
        "updatedAt": "2024-01-01T00:00:00Z",
        "updatedBy": "789e0123-e89b-12d3-a456-426614174000",
        "lessons": [
          {
            "lessonId": "789e0123-e89b-12d3-a456-426614174000",
            "tenantId": "123e4567-e89b-12d3-a456-426614174000",
            "organisationId": "456e7890-e89b-12d3-a456-426614174000",
            "checkedOut": null,
            "checkedOutTime": null,
            "title": "Introduction to HTML",
            "alias": "intro-html",
            "status": "published",
            "description": "Learn HTML basics",
            "image": "/uploads/lessons/lesson-thumb.jpg",
            "startDatetime": "2024-01-01T00:00:00Z",
            "endDatetime": "2024-12-31T23:59:59Z",
            "storage": "local",
            "noOfAttempts": 1,
            "attemptsGrade": "highest",
            "format": "video",
            "mediaId": "abc12345-e89b-12d3-a456-426614174000",
            "prerequisites": [],
            "idealTime": 30,
            "resume": false,
            "totalMarks": 100,
            "passingMarks": 60,
            "params": null,
            "courseId": "123e4567-e89b-12d3-a456-426614174000",
            "moduleId": "456e7890-e89b-12d3-a456-426614174000",
            "sampleLesson": false,
            "considerForPassing": true,
            "ordering": 1,
            "createdAt": "2024-01-01T00:00:00Z",
            "createdBy": "789e0123-e89b-12d3-a456-426614174000",
            "updatedAt": "2024-01-01T00:00:00Z",
            "updatedBy": "789e0123-e89b-12d3-a456-426614174000",
            "tracking": {
              "status": "completed",
              "canResume": false,
              "canReattempt": false,
              "completionPercentage": 100,
              "lastAccessed": "2024-01-01T10:30:00Z",
              "timeSpent": 1800,
              "score": 95,
              "attempt": {
                "attemptId": "track-12345",
                "attemptNumber": 1,
                "startDatetime": "2024-01-01T09:00:00Z",
                "endDatetime": "2024-01-01T09:30:00Z",
                "totalContent": 100,
                "currentPosition": 100
              }
            }
          }
        ],
        "tracking": {
          "status": "in_progress",
          "progress": 75,
          "completedLessons": 3,
          "totalLessons": 4
        }
      }
    ],
    "tracking": {
      "status": "in_progress",
      "progress": 60,
      "completedLessons": 15,
      "totalLessons": 25,
      "lastAccessed": "2024-01-01T10:30:00Z",
      "timeSpent": 3600,
      "startDatetime": "2024-01-01T09:00:00Z",
      "endDatetime": null
    },
    "lastAccessedLesson": {
      "lessonId": "789e0123-e89b-12d3-a456-426614174000",
      "attempt": {
        "attemptId": "track-12345",
        "attemptNumber": 1,
        "status": "completed",
        "startDatetime": "2024-01-01T09:00:00Z",
        "endDatetime": "2024-01-01T09:30:00Z",
        "score": 95,
        "completionPercentage": 100,
        "timeSpent": 1800,
        "lastAccessed": "2024-01-01T10:30:00Z",
        "totalContent": 100,
        "currentPosition": 100
      }
    },
    "eligibility": {
      "requiredCourses": [],
      "isEligible": true
    }
  }
}
```

### **Scenario 4: includeLessons=true, moduleId=specified (Single module with lessons)**
```json
{
  "id": "api.course.tracking",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "moduleId": "456e7890-e89b-12d3-a456-426614174000",
    "parentId": null,
    "courseId": "123e4567-e89b-12d3-a456-426614174000",
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "organisationId": "456e7890-e89b-12d3-a456-426614174000",
    "title": "Module 1: HTML Basics",
    "description": "Learn HTML fundamentals",
    "image": "/uploads/modules/module-thumb.jpg",
    "startDatetime": "2024-01-01T00:00:00Z",
    "endDatetime": "2024-12-31T23:59:59Z",
    "prerequisites": [],
    "badgeTerm": null,
    "badgeId": null,
    "ordering": 1,
    "status": "published",
    "createdAt": "2024-01-01T00:00:00Z",
    "createdBy": "789e0123-e89b-12d3-a456-426614174000",
    "updatedAt": "2024-01-01T00:00:00Z",
    "updatedBy": "789e0123-e89b-12d3-a456-426614174000",
    "lessons": [
      {
        "lessonId": "789e0123-e89b-12d3-a456-426614174000",
        "tenantId": "123e4567-e89b-12d3-a456-426614174000",
        "organisationId": "456e7890-e89b-12d3-a456-426614174000",
        "checkedOut": null,
        "checkedOutTime": null,
        "title": "Introduction to HTML",
        "alias": "intro-html",
        "status": "published",
        "description": "Learn HTML basics",
        "image": "/uploads/lessons/lesson-thumb.jpg",
        "startDatetime": "2024-01-01T00:00:00Z",
        "endDatetime": "2024-12-31T23:59:59Z",
        "storage": "local",
        "noOfAttempts": 1,
        "attemptsGrade": "highest",
        "format": "video",
        "mediaId": "abc12345-e89b-12d3-a456-426614174000",
        "prerequisites": [],
        "idealTime": 30,
        "resume": false,
        "totalMarks": 100,
        "passingMarks": 60,
        "params": null,
        "courseId": "123e4567-e89b-12d3-a456-426614174000",
        "moduleId": "456e7890-e89b-12d3-a456-426614174000",
        "sampleLesson": false,
        "considerForPassing": true,
        "ordering": 1,
        "createdAt": "2024-01-01T00:00:00Z",
        "createdBy": "789e0123-e89b-12d3-a456-426614174000",
        "updatedAt": "2024-01-01T00:00:00Z",
        "updatedBy": "789e0123-e89b-12d3-a456-426614174000",
        "tracking": {
          "status": "completed",
          "canResume": false,
          "canReattempt": false,
          "completionPercentage": 100,
          "lastAccessed": "2024-01-01T10:30:00Z",
          "timeSpent": 1800,
          "score": 95,
          "attempt": {
            "attemptId": "track-12345",
            "attemptNumber": 1,
            "startDatetime": "2024-01-01T09:00:00Z",
            "endDatetime": "2024-01-01T09:30:00Z",
            "totalContent": 100,
            "currentPosition": 100
          }
        }
      }
    ],
    "tracking": {
      "status": "in_progress",
      "progress": 75,
      "completedLessons": 3,
      "totalLessons": 4
    },
    "eligibility": {
      "requiredCourses": [],
      "isEligible": true
    }
  }
}
```

#### Update Course

**Endpoint**: `PATCH /courses/{courseId}`

**HTTP Method**: PATCH

**Content-Type**: `multipart/form-data`

**Description**: Update an existing course

**Headers**:
```
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Path Parameters**:
- `courseId` (UUID, required): Course ID

**Request Parameters**: Same as Create Course (all optional)

**Query Parameters**:
- `userId` (UUID, required): User ID updating the course

**Response Structure**:
```json
{
  "id": "api.course.update",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "courseId": "123e4567-e89b-12d3-a456-426614174000",
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "organisationId": "456e7890-e89b-12d3-a456-426614174000",
    "title": "Updated Course Title",
    "alias": "updated-course",
    "shortDescription": "Updated brief description",
    "description": "Updated detailed description",
    "image": "/uploads/courses/updated-thumb.jpg",
    "featured": true,
    "free": false,
    "certificateTerm": null,
    "rewardType": "certificate",
    "templateId": null,
    "prerequisites": [],
    "startDatetime": "2024-01-01T00:00:00Z",
    "endDatetime": "2024-12-31T23:59:59Z",
    "adminApproval": false,
    "autoEnroll": false,
    "status": "published",
    "params": null,
    "createdBy": "789e0123-e89b-12d3-a456-426614174000",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedBy": "789e0123-e89b-12d3-a456-426614174000",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

**Validations and Conditions**:

**Input Validation Rules**:
- `courseId` path parameter must be present and valid UUID format
- `tenantid` header must be present and valid UUID format
- `organisationid` header must be present and valid UUID format
- `userId` query parameter must be present and valid UUID
- All update fields follow same validation rules as Create Course
- `title` must be max 255 characters (if provided)
- `alias` must be unique within the tenant, alphanumeric with hyphens only (if provided)
- `startDatetime` must be valid ISO date format (if provided)
- `endDatetime` must be valid ISO date format and after startDatetime (if provided)
- `image` file must be valid image format (JPG, PNG, GIF) and max 5MB (if provided)

**Business Logic Conditions**:
- Course must exist and be accessible for update
- Course must belong to the specified tenant and organization
- If updating alias, new alias must be unique within tenant
- If updating status to 'published', all required fields must be completed
- If updating adminApproval to true, course status must be 'unpublished'
- If updating autoEnroll to true, course must be free or have proper enrollment rules
- If updating prerequisites, all prerequisite courses must exist
- If updating templateId, template must exist and be accessible
- Update must be atomic (all-or-nothing)
- Audit trail must be maintained for course updates
- Image upload must be processed and stored securely (if provided)

**Authorization Conditions**:
- User must have update permissions for courses in the tenant
- User must have access to the specified organization
- Course creator can update their own courses
- Admin users can update any course
- If updating featured status, user must have admin privileges
- If updating adminApproval, user must have admin permissions

#### Delete Course

**Endpoint**: `DELETE /courses/{courseId}`

**HTTP Method**: DELETE

**Description**: Archive/delete a course

**Headers**:
```
Content-Type: application/json
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Path Parameters**:
- `courseId` (UUID, required): Course ID

**Query Parameters**:
- `userId` (UUID, required): User ID deleting the course

**Response Structure**:
```json
{
  "id": "api.course.delete",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "success": true,
    "message": "Course deleted successfully"
  }
}
```

**Validations and Conditions**:

**Input Validation Rules**:
- `courseId` path parameter must be present and valid UUID format
- `tenantid` header must be present and valid UUID format
- `organisationid` header must be present and valid UUID format
- `userId` query parameter must be present and valid UUID

**Business Logic Conditions**:
- Course must exist and be accessible for deletion
- Course must belong to the specified tenant and organization
- If course has active enrollments, deletion should be prevented or handled appropriately
- If course has associated modules/lessons, they should be archived or deleted
- If course has associated media, media should be cleaned up
- Deletion must be atomic (all-or-nothing)
- Audit trail must be maintained for course deletion
- Soft delete should be implemented (mark as archived rather than hard delete)
- If course is published and has enrollments, special handling may be required

**Authorization Conditions**:
- User must have delete permissions for courses in the tenant
- User must have access to the specified organization
- Course creator can delete their own courses
- Admin users can delete any course
- If course has active enrollments, only admin users can delete
- If course is published, special permissions may be required for deletion

#### Clone Course

**Endpoint**: `POST /courses/clone/{courseId}`

**HTTP Method**: POST

**Description**: Create a deep copy of a course with all modules, lessons, and media

**Headers**:
```
Content-Type: application/json
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Path Parameters**:
- `courseId` (UUID, required): Course ID to clone

**Query Parameters**:
- `userId` (UUID, required): User ID creating the clone

**Response Structure**:
```json
{
  "id": "api.course.clone",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 201,
  "result": {
    "courseId": "987e6543-e89b-12d3-a456-426614174000",
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "organisationId": "456e7890-e89b-12d3-a456-426614174000",
    "title": "Introduction to Web Development (Copy)",
    "alias": "intro-web-dev-copy",
    "shortDescription": "A brief intro to web development",
    "description": "Learn the fundamentals of web development",
    "image": "/uploads/courses/course-thumb.jpg",
    "featured": false,
    "free": false,
    "certificateTerm": null,
    "rewardType": "certificate",
    "templateId": null,
    "prerequisites": [],
    "startDatetime": "2024-01-01T00:00:00Z",
    "endDatetime": "2024-12-31T23:59:59Z",
    "adminApproval": false,
    "autoEnroll": false,
    "status": "unpublished",
    "params": null,
    "createdBy": "789e0123-e89b-12d3-a456-426614174000",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedBy": "789e0123-e89b-12d3-a456-426614174000",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

#### Update Course Structure

**Endpoint**: `PUT /courses/{courseId}/structure`

**HTTP Method**: PUT

**Description**: Update the entire course structure including module and lesson ordering

**Headers**:
```
Content-Type: application/json
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Path Parameters**:
- `courseId` (UUID, required): Course ID

**Request Body**:
```json
{
  "modules": [
    {
      "moduleId": "456e7890-e89b-12d3-a456-426614174000",
      "order": 1,
      "lessons": [
        {
          "lessonId": "789e0123-e89b-12d3-a456-426614174000",
          "order": 1
        }
      ]
    }
  ]
}
```

**Query Parameters**:
- `userId` (UUID, required): User ID updating the structure

**Response Structure**:
```json
{
  "id": "api.course.restructure",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "success": true,
    "message": "Course structure updated successfully"
  }
}
```

---

### Modules

#### Create Module

**Endpoint**: `POST /modules`

**HTTP Method**: POST

**Content-Type**: `multipart/form-data`

**Description**: Create a new module

**Headers**:
```
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Request Parameters**:
- `title` (string, required): Module title (max 255 characters)
- `alias` (string, optional): Module alias/slug
- `description` (string, optional): Module description
- `courseId` (UUID, required): Parent course ID
- `parentId` (UUID, optional): Parent module ID (for submodules)
- `ordering` (number, optional): Module order within course or parent module
- `status` (enum, optional): Module status - 'published', 'unpublished', 'archived' (default: 'unpublished')
- `image` (file, optional): Module thumbnail image
- `startDatetime` (string, optional): Module start date (ISO format)
- `endDatetime` (string, optional): Module end date (ISO format)
- `prerequisites` (array, optional): Array of prerequisite module IDs
- `badgeId` (UUID, optional): Badge ID associated with the module
- `badgeTerm` (object, optional): Badge terms for the module
- `params` (object, optional): Additional parameters (JSON object)

**Query Parameters**:
- `userId` (UUID, required): User ID creating the module

**Response Structure**:
```json
{
  "id": "api.module.create",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 201,
  "result": {
    "moduleId": "456e7890-e89b-12d3-a456-426614174000",
    "parentId": null,
    "courseId": "123e4567-e89b-12d3-a456-426614174000",
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "organisationId": "456e7890-e89b-12d3-a456-426614174000",
    "title": "Module 1: HTML Basics",
    "description": "Learn HTML fundamentals",
    "image": "/uploads/modules/module-thumb.jpg",
    "startDatetime": "2024-01-01T00:00:00Z",
    "endDatetime": "2024-12-31T23:59:59Z",
    "prerequisites": [],
    "badgeTerm": null,
    "badgeId": null,
    "ordering": 1,
    "status": "unpublished",
    "createdAt": "2024-01-01T00:00:00Z",
    "createdBy": "789e0123-e89b-12d3-a456-426614174000",
    "updatedAt": "2024-01-01T00:00:00Z",
    "updatedBy": "789e0123-e89b-12d3-a456-426614174000"
  }
}
```

**Validations and Conditions**:

**Input Validation Rules**:
- `title` must be present, non-empty, and max 255 characters
- `courseId` must be present and valid UUID format
- `alias` must be string (if provided)
- `parentId` must be valid UUID format (if provided)
- `ordering` must be number (if provided)
- `description` must be string (if provided)
- `status` must be one of: 'published', 'unpublished', 'archived' (default: 'unpublished')
- `image` file must be valid image format and within tenant-configured size limits (if provided)
- `startDatetime` must be valid date format (if provided)
- `endDatetime` must be valid date format and after startDatetime (if provided)
- `prerequisites` must be array of valid UUIDs (if provided)
- `badgeId` must be valid UUID format (if provided)
- `badgeTerm` must be valid JSON object (if provided)
- `params` must be valid JSON object (if provided)
- `userId` query parameter must be present and valid UUID

**Business Logic Conditions**:
- Course must exist and be accessible
- Course must belong to the specified tenant and organization
- If parentId is provided, parent module must exist and be accessible
- If prerequisites are specified, all prerequisite modules must exist
- If badgeId is provided, badge must exist and be accessible
- Module creation must be atomic (all-or-nothing)
- Audit trail must be maintained for module creation
- Image upload must be processed and stored securely according to tenant configuration
- If module is published, all required fields must be completed
- If parentId is provided, parent module must belong to the same course

**Authorization Conditions**:
- User must have create permissions for modules in the tenant
- User must have access to the specified organization
- User must have access to the parent course
- If creating nested module, user must have access to parent module

#### Get Module by ID

**Endpoint**: `GET /modules/{moduleId}`

**HTTP Method**: GET

**Description**: Retrieve a specific module by its ID

**Headers**:
```
Content-Type: application/json
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Path Parameters**:
- `moduleId` (UUID, required): Module ID

**Response Structure**:
```json
{
  "id": "api.module.read",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "moduleId": "456e7890-e89b-12d3-a456-426614174000",
    "parentId": null,
    "courseId": "123e4567-e89b-12d3-a456-426614174000",
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "organisationId": "456e7890-e89b-12d3-a456-426614174000",
    "title": "Module 1: HTML Basics",
    "description": "Learn HTML fundamentals",
    "image": "/uploads/modules/module-thumb.jpg",
    "startDatetime": "2024-01-01T00:00:00Z",
    "endDatetime": "2024-12-31T23:59:59Z",
    "prerequisites": [],
    "badgeTerm": null,
    "badgeId": null,
    "ordering": 1,
    "status": "published",
    "createdAt": "2024-01-01T00:00:00Z",
    "createdBy": "789e0123-e89b-12d3-a456-426614174000",
    "updatedAt": "2024-01-01T00:00:00Z",
    "updatedBy": "789e0123-e89b-12d3-a456-426614174000"
  }
}
```

#### Get Modules by Course

**Endpoint**: `GET /modules/course/{courseId}`

**HTTP Method**: GET

**Description**: Get all modules for a specific course

**Headers**:
```
Content-Type: application/json
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Path Parameters**:
- `courseId` (UUID, required): Course ID

**Response Structure**:
```json
{
  "id": "api.module.list",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": [
    {
      "moduleId": "456e7890-e89b-12d3-a456-426614174000",
      "parentId": null,
      "courseId": "123e4567-e89b-12d3-a456-426614174000",
      "tenantId": "123e4567-e89b-12d3-a456-426614174000",
      "organisationId": "456e7890-e89b-12d3-a456-426614174000",
      "title": "Module 1: HTML Basics",
      "description": "Learn HTML fundamentals",
      "image": "/uploads/modules/module-thumb.jpg",
      "startDatetime": "2024-01-01T00:00:00Z",
      "endDatetime": "2024-12-31T23:59:59Z",
      "prerequisites": [],
      "badgeTerm": null,
      "badgeId": null,
      "ordering": 1,
      "status": "published",
      "createdAt": "2024-01-01T00:00:00Z",
      "createdBy": "789e0123-e89b-12d3-a456-426614174000",
      "updatedAt": "2024-01-01T00:00:00Z",
      "updatedBy": "789e0123-e89b-12d3-a456-426614174000"
    }
  ]
}
```

#### Get Submodules by Parent

**Endpoint**: `GET /modules/parent/{parentId}`

**HTTP Method**: GET

**Description**: Get submodules for a parent module

**Headers**:
```
Content-Type: application/json
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Path Parameters**:
- `parentId` (UUID, required): Parent module ID

**Response Structure**:
```json
{
  "id": "api.module.list",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": [
    {
      "moduleId": "789e0123-e89b-12d3-a456-426614174000",
      "parentId": "456e7890-e89b-12d3-a456-426614174000",
      "courseId": "123e4567-e89b-12d3-a456-426614174000",
      "tenantId": "123e4567-e89b-12d3-a456-426614174000",
      "organisationId": "456e7890-e89b-12d3-a456-426614174000",
      "title": "Submodule 1.1",
      "description": "Advanced HTML concepts",
      "image": "/uploads/modules/submodule-thumb.jpg",
      "startDatetime": "2024-01-01T00:00:00Z",
      "endDatetime": "2024-12-31T23:59:59Z",
      "prerequisites": [],
      "badgeTerm": null,
      "badgeId": null,
      "ordering": 1,
      "status": "published",
      "createdAt": "2024-01-01T00:00:00Z",
      "createdBy": "789e0123-e89b-12d3-a456-426614174000",
      "updatedAt": "2024-01-01T00:00:00Z",
      "updatedBy": "789e0123-e89b-12d3-a456-426614174000"
    }
  ]
}
```

#### Update Module

**Endpoint**: `PATCH /modules/{moduleId}`

**HTTP Method**: PATCH

**Content-Type**: `multipart/form-data`

**Description**: Update an existing module

**Headers**:
```
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Path Parameters**:
- `moduleId` (UUID, required): Module ID

**Request Parameters**: Same as Create Module (all optional)

**Query Parameters**:
- `userId` (UUID, required): User ID updating the module

**Response Structure**:
```json
{
  "id": "api.module.update",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "moduleId": "456e7890-e89b-12d3-a456-426614174000",
    "parentId": null,
    "courseId": "123e4567-e89b-12d3-a456-426614174000",
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "organisationId": "456e7890-e89b-12d3-a456-426614174000",
    "title": "Updated Module Title",
    "description": "Updated module description",
    "image": "/uploads/modules/updated-thumb.jpg",
    "startDatetime": "2024-01-01T00:00:00Z",
    "endDatetime": "2024-12-31T23:59:59Z",
    "prerequisites": [],
    "badgeTerm": null,
    "badgeId": null,
    "ordering": 1,
    "status": "published",
    "createdAt": "2024-01-01T00:00:00Z",
    "createdBy": "789e0123-e89b-12d3-a456-426614174000",
    "updatedAt": "2024-01-01T00:00:00Z",
    "updatedBy": "789e0123-e89b-12d3-a456-426614174000"
  }
}
```

#### Delete Module

**Endpoint**: `DELETE /modules/{moduleId}`

**HTTP Method**: DELETE

**Description**: Archive/delete a module

**Headers**:
```
Content-Type: application/json
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Path Parameters**:
- `moduleId` (UUID, required): Module ID

**Query Parameters**:
- `userId` (UUID, required): User ID deleting the module

**Response Structure**:
```json
{
  "id": "api.module.delete",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "success": true,
    "message": "Module deleted successfully"
  }
}
```

---

### Lessons

#### Create Lesson

**Endpoint**: `POST /lessons`

**HTTP Method**: POST

**Content-Type**: `multipart/form-data`

**Description**: Create a new lesson

**Headers**:
```
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Request Parameters**:
- `title` (string, required): Lesson title (max 255 characters)
- `alias` (string, optional): Lesson alias/slug
- `description` (string, optional): Lesson description
- `moduleId` (UUID, required): Parent module ID
- `courseId` (UUID, optional): Course ID
- `format` (enum, required): Lesson format - 'video', 'document', 'test', 'event', 'text_and_media'
- `mediaContentSource` (string, required): Media content source (URL for video/external content)
- `mediaContentPath` (string, required for document format): Media content path
- `mediaContentSubFormat` (enum, required): Media content sub-format - 'youtube.url', 'video.url', 'pdf', 'quiz', 'assessment', 'feedback', 'event', 'external.url'
- `image` (file, optional): Lesson thumbnail image
- `checkedOut` (UUID, optional): User ID who checked out the lesson
- `status` (enum, optional): Lesson status - 'published', 'unpublished', 'archived' (default: 'published')
- `startDatetime` (string, optional): Lesson start date (ISO format)
- `endDatetime` (string, optional): Lesson end date (ISO format)
- `storage` (string, optional): Storage type (default: 'local')
- `noOfAttempts` (number, optional): Number of attempts allowed (0 for unlimited, default: 1)
- `attemptsGrade` (enum, optional): Grade calculation method - 'first_attempt', 'last_attempt', 'average', 'highest' (default: 'highest')
- `prerequisites` (array, optional): Array of prerequisite lesson IDs
- `idealTime` (number, optional): Ideal time in minutes
- `resume` (boolean, optional): Whether lesson can be resumed (default: false)
- `totalMarks` (number, optional): Total marks
- `passingMarks` (number, optional): Passing marks
- `sampleLesson` (boolean, optional): Whether this is a free lesson (default: false)
- `ordering` (number, optional): Lesson order within module
- `considerForPassing` (boolean, optional): Whether to consider this lesson for passing (default: true)
- `params` (object, optional): Additional parameters (JSON object)

**Query Parameters**:
- `userId` (UUID, required): User ID creating the lesson

**Response Structure**:
```json
{
  "id": "api.lesson.create",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 201,
  "result": {
    "lessonId": "789e0123-e89b-12d3-a456-426614174000",
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "organisationId": "456e7890-e89b-12d3-a456-426614174000",
    "checkedOut": null,
    "checkedOutTime": null,
    "title": "Introduction to HTML",
    "alias": "intro-html",
    "status": "published",
    "description": "Learn HTML basics",
    "image": "/uploads/lessons/lesson-thumb.jpg",
    "startDatetime": "2024-01-01T00:00:00Z",
    "endDatetime": "2024-12-31T23:59:59Z",
    "storage": "local",
    "noOfAttempts": 1,
    "attemptsGrade": "highest",
    "format": "video",
    "mediaId": "abc12345-e89b-12d3-a456-426614174000",
    "prerequisites": [],
    "idealTime": 30,
    "resume": false,
    "totalMarks": 100,
    "passingMarks": 60,
    "params": null,
    "courseId": "123e4567-e89b-12d3-a456-426614174000",
    "moduleId": "456e7890-e89b-12d3-a456-426614174000",
    "sampleLesson": false,
    "considerForPassing": true,
    "ordering": 1,
    "createdAt": "2024-01-01T00:00:00Z",
    "createdBy": "789e0123-e89b-12d3-a456-426614174000",
    "updatedAt": "2024-01-01T00:00:00Z",
    "updatedBy": "789e0123-e89b-12d3-a456-426614174000"
  }
}
```

**Validations and Conditions**:

**Input Validation Rules**:
- `title` must be present, non-empty, and max 255 characters
- `format` must be one of: 'video', 'document', 'test', 'event', 'text_and_media'
- `mediaContentSource` must be present and valid URL (for non-document formats)
- `mediaContentPath` must be present for document format
- `mediaContentSubFormat` must be one of: 'youtube.url', 'video.url', 'pdf', 'quiz', 'assessment', 'feedback', 'event', 'external.url'
- `alias` must be string (if provided)
- `description` must be string type (if provided)
- `image` file must be valid image format and within tenant-configured size limits (if provided)
- `checkedOut` must be valid UUID format (if provided)
- `status` must be one of: 'published', 'unpublished', 'archived' (default: 'published')
- `startDatetime` must be valid date format (if provided)
- `endDatetime` must be valid date format and after startDatetime (if provided)
- `storage` must be string (default: 'local')
- `noOfAttempts` must be non-negative integer (0 for unlimited, default: 1)
- `attemptsGrade` must be one of: 'first_attempt', 'last_attempt', 'average', 'highest' (default: 'highest')
- `prerequisites` must be array of valid UUIDs (if provided)
- `idealTime` must be positive integer in minutes (if provided)
- `resume` must be boolean value (default: false)
- `totalMarks` must be non-negative integer (if provided)
- `passingMarks` must be non-negative integer (if provided)
- `sampleLesson` must be boolean value (default: false)
- `ordering` must be number (if provided)
- `considerForPassing` must be boolean value (default: true)
- `params` must be valid JSON object (if provided)
- `courseId` must be present and valid UUID format
- `moduleId` must be present and valid UUID format
- `userId` query parameter must be present and valid UUID

**Business Logic Conditions**:
- Module must exist and be accessible
- Module must belong to the specified tenant and organization
- If courseId is provided, course must exist and module must belong to it
- If prerequisites are specified, all prerequisite lessons must exist
- If mediaId is provided, media must exist and be accessible
- Lesson creation must be atomic (all-or-nothing)
- Audit trail must be maintained for lesson creation
- Image upload must be processed and stored securely according to tenant configuration
- If lesson is published, all required fields must be completed
- If format is 'document', mediaContentPath must be provided
- If format is 'video', mediaContentSource must be provided

**Authorization Conditions**:
- User must have create permissions for lessons in the tenant
- User must have access to the specified organization
- User must have access to the parent module
- If setting checkedOut, user must have checkout permissions
- If creating sample lesson, user must have admin privileges

#### Get All Lessons

**Endpoint**: `GET /lessons`

**HTTP Method**: GET

**Description**: Get all lessons with optional filtering

**Headers**:
```
Content-Type: application/json
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Query Parameters**:
- `status` (enum, optional): Filter by lesson status - 'published', 'unpublished', 'archived'
- `format` (enum, optional): Filter by lesson format - 'video', 'document', 'test', 'event', 'text_and_media'
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10)

**Response Structure**:
```json
{
  "id": "api.lesson.list",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": [
    {
      "lessonId": "789e0123-e89b-12d3-a456-426614174000",
      "tenantId": "123e4567-e89b-12d3-a456-426614174000",
      "organisationId": "456e7890-e89b-12d3-a456-426614174000",
      "checkedOut": null,
      "checkedOutTime": null,
      "title": "Introduction to HTML",
      "alias": "intro-html",
      "status": "published",
      "description": "Learn HTML basics",
      "image": "/uploads/lessons/lesson-thumb.jpg",
      "startDatetime": "2024-01-01T00:00:00Z",
      "endDatetime": "2024-12-31T23:59:59Z",
      "storage": "local",
      "noOfAttempts": 1,
      "attemptsGrade": "highest",
      "format": "video",
      "mediaId": "abc12345-e89b-12d3-a456-426614174000",
      "prerequisites": [],
      "idealTime": 30,
      "resume": false,
      "totalMarks": 100,
      "passingMarks": 60,
      "params": null,
      "courseId": "123e4567-e89b-12d3-a456-426614174000",
      "moduleId": "456e7890-e89b-12d3-a456-426614174000",
      "sampleLesson": false,
      "considerForPassing": true,
      "ordering": 1,
      "createdAt": "2024-01-01T00:00:00Z",
      "createdBy": "789e0123-e89b-12d3-a456-426614174000",
      "updatedAt": "2024-01-01T00:00:00Z",
      "updatedBy": "789e0123-e89b-12d3-a456-426614174000"
    }
  ]
}
```

#### Get Lesson by ID

**Endpoint**: `GET /lessons/{lessonId}`

**HTTP Method**: GET

**Description**: Retrieve a specific lesson by its ID

**Headers**:
```
Content-Type: application/json
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Path Parameters**:
- `lessonId` (UUID, required): Lesson ID

**Response Structure**:
```json
{
  "id": "api.lesson.read",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "lessonId": "789e0123-e89b-12d3-a456-426614174000",
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "organisationId": "456e7890-e89b-12d3-a456-426614174000",
    "checkedOut": null,
    "checkedOutTime": null,
    "title": "Introduction to HTML",
    "alias": "intro-html",
    "status": "published",
    "description": "Learn HTML basics",
    "image": "/uploads/lessons/lesson-thumb.jpg",
    "startDatetime": "2024-01-01T00:00:00Z",
    "endDatetime": "2024-12-31T23:59:59Z",
    "storage": "local",
    "noOfAttempts": 1,
    "attemptsGrade": "highest",
    "format": "video",
    "mediaId": "abc12345-e89b-12d3-a456-426614174000",
    "media": {
      "mediaId": "abc12345-e89b-12d3-a456-426614174000",
      "tenantId": "123e4567-e89b-12d3-a456-426614174000",
      "organisationId": "456e7890-e89b-12d3-a456-426614174000",
      "format": "video",
      "subFormat": "video.youtube",
      "path": "/uploads/media/video-123.mp4",
      "source": "https://youtube.com/watch?v=example",
      "storage": "local",
      "params": {
        "duration": 120,
        "resolution": "720p"
      },
      "createdBy": "789e0123-e89b-12d3-a456-426614174000",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    },
    "prerequisites": [],
    "idealTime": 30,
    "resume": false,
    "totalMarks": 100,
    "passingMarks": 60,
    "params": null,
    "courseId": "123e4567-e89b-12d3-a456-426614174000",
    "moduleId": "456e7890-e89b-12d3-a456-426614174000",
    "sampleLesson": false,
    "considerForPassing": true,
    "ordering": 1,
    "createdAt": "2024-01-01T00:00:00Z",
    "createdBy": "789e0123-e89b-12d3-a456-426614174000",
    "updatedAt": "2024-01-01T00:00:00Z",
    "updatedBy": "789e0123-e89b-12d3-a456-426614174000"
  }
}
```

#### Get Lessons by Module

**Endpoint**: `GET /lessons/module/{moduleId}`

**HTTP Method**: GET

**Description**: Get all lessons for a specific module

**Headers**:
```
Content-Type: application/json
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Path Parameters**:
- `moduleId` (UUID, required): Module ID

**Response Structure**:
```json
{
  "id": "api.lesson.list",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": [
    {
      "lessonId": "789e0123-e89b-12d3-a456-426614174000",
      "tenantId": "123e4567-e89b-12d3-a456-426614174000",
      "organisationId": "456e7890-e89b-12d3-a456-426614174000",
      "checkedOut": null,
      "checkedOutTime": null,
      "title": "Introduction to HTML",
      "alias": "intro-html",
      "status": "published",
      "description": "Learn HTML basics",
      "image": "/uploads/lessons/lesson-thumb.jpg",
      "startDatetime": "2024-01-01T00:00:00Z",
      "endDatetime": "2024-12-31T23:59:59Z",
      "storage": "local",
      "noOfAttempts": 1,
      "attemptsGrade": "highest",
      "format": "video",
      "mediaId": "abc12345-e89b-12d3-a456-426614174000",
      "media": {
        "mediaId": "abc12345-e89b-12d3-a456-426614174000",
        "tenantId": "123e4567-e89b-12d3-a456-426614174000",
        "organisationId": "456e7890-e89b-12d3-a456-426614174000",
        "format": "video",
        "subFormat": "video.youtube",
        "path": "/uploads/media/video-123.mp4",
        "source": "https://youtube.com/watch?v=example",
        "storage": "local",
        "params": {
          "duration": 120,
          "resolution": "720p"
        },
        "createdBy": "789e0123-e89b-12d3-a456-426614174000",
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-01T00:00:00Z"
      },
      "prerequisites": [],
      "idealTime": 30,
      "resume": false,
      "totalMarks": 100,
      "passingMarks": 60,
      "params": null,
      "courseId": "123e4567-e89b-12d3-a456-426614174000",
      "moduleId": "456e7890-e89b-12d3-a456-426614174000",
      "sampleLesson": false,
      "considerForPassing": true,
      "ordering": 1,
      "createdAt": "2024-01-01T00:00:00Z",
      "createdBy": "789e0123-e89b-12d3-a456-426614174000",
      "updatedAt": "2024-01-01T00:00:00Z",
      "updatedBy": "789e0123-e89b-12d3-a456-426614174000"
    }
  ]
}
```

#### Update Lesson

**Endpoint**: `PATCH /lessons/{lessonId}`

**HTTP Method**: PATCH

**Content-Type**: `multipart/form-data`

**Description**: Update an existing lesson

**Headers**:
```
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Path Parameters**:
- `lessonId` (UUID, required): Lesson ID

**Request Parameters**: Same as Create Lesson (all optional)

**Query Parameters**:
- `userId` (UUID, required): User ID updating the lesson

**Response Structure**:
```json
{
  "id": "api.lesson.update",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "lessonId": "789e0123-e89b-12d3-a456-426614174000",
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "organisationId": "456e7890-e89b-12d3-a456-426614174000",
    "checkedOut": null,
    "checkedOutTime": null,
    "title": "Updated Lesson Title",
    "alias": "updated-lesson",
    "status": "published",
    "description": "Updated lesson description",
    "image": "/uploads/lessons/updated-thumb.jpg",
    "startDatetime": "2024-01-01T00:00:00Z",
    "endDatetime": "2024-12-31T23:59:59Z",
    "storage": "local",
    "noOfAttempts": 1,
    "attemptsGrade": "highest",
    "format": "video",
    "mediaId": "abc12345-e89b-12d3-a456-426614174000",
    "media": {
      "mediaId": "abc12345-e89b-12d3-a456-426614174000",
      "tenantId": "123e4567-e89b-12d3-a456-426614174000",
      "organisationId": "456e7890-e89b-12d3-a456-426614174000",
      "format": "video",
      "subFormat": "video.youtube",
      "path": "/uploads/media/video-123.mp4",
      "source": "https://youtube.com/watch?v=example",
      "storage": "local",
      "params": {
        "duration": 120,
        "resolution": "720p"
      },
      "createdBy": "789e0123-e89b-12d3-a456-426614174000",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    },
    "prerequisites": [],
    "idealTime": 30,
    "resume": false,
    "totalMarks": 100,
    "passingMarks": 60,
    "params": null,
    "courseId": "123e4567-e89b-12d3-a456-426614174000",
    "moduleId": "456e7890-e89b-12d3-a456-426614174000",
    "sampleLesson": false,
    "considerForPassing": true,
    "ordering": 1,
    "createdAt": "2024-01-01T00:00:00Z",
    "createdBy": "789e0123-e89b-12d3-a456-426614174000",
    "updatedAt": "2024-01-01T00:00:00Z",
    "updatedBy": "789e0123-e89b-12d3-a456-426614174000"
  }
}
```

#### Delete Lesson

**Endpoint**: `DELETE /lessons/{lessonId}`

**HTTP Method**: DELETE

**Description**: Delete a lesson

**Headers**:
```
Content-Type: application/json
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Path Parameters**:
- `lessonId` (UUID, required): Lesson ID

**Query Parameters**:
- `userId` (UUID, required): User ID deleting the lesson

**Response Structure**:
```json
{
  "id": "api.lesson.delete",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "success": true,
    "message": "Lesson deleted successfully"
  }
}
```

---

### Media

#### Upload Media

**Endpoint**: `POST /media/upload`

**HTTP Method**: POST

**Content-Type**: `multipart/form-data`

**Description**: Upload media file

**Headers**:
```
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Request Parameters**:
- `format` (enum, required): Media format - 'video', 'document', 'test', 'event'
- `subFormat` (string, optional): Media sub-format (e.g., 'video.youtube')
- `path` (string, optional): Media path
- `source` (string, optional): Media source (URL, content, etc.)
- `storage` (string, optional): Storage type (default: 'local')
- `params` (object, optional): Additional parameters (JSON object)
- `createdBy` (string, optional): User who created the media
- `file` (file, optional): Media file (required for document format)

**Query Parameters**:
- `userId` (UUID, required): User ID uploading the media

**Response Structure**:
```json
{
  "id": "api.media.upload",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 201,
  "result": {
    "mediaId": "abc12345-e89b-12d3-a456-426614174000",
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "organisationId": "456e7890-e89b-12d3-a456-426614174000",
    "format": "video",
    "subFormat": "video.youtube",
    "path": "/uploads/media/video-123.mp4",
    "source": "https://youtube.com/watch?v=example",
    "storage": "local",
    "params": {
      "duration": 120,
      "resolution": "720p"
    },
    "createdBy": "789e0123-e89b-12d3-a456-426614174000",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

**Validations and Conditions**:

**Input Validation Rules**:
- `file` must be present and valid file upload
- File must be in multipart/form-data format
- File size must be within tenant-configured limits for media uploads
- File type must be within tenant-configured allowed formats
- `lessonId` must be present and valid UUID format
- `userId` query parameter must be present and valid UUID

**Business Logic Conditions**:
- Lesson must exist and be accessible
- Lesson must belong to the specified tenant and organization
- Media file must be processed and stored securely
- Media association must be created with the lesson
- File upload must be atomic (all-or-nothing)
- Audit trail must be maintained for media upload
- If lesson already has media, it may be replaced or additional media added
- Media file must be accessible and readable

**Authorization Conditions**:
- User must have upload permissions for media in the tenant
- User must have access to the specified organization
- User must have access to the lesson for media association
- If replacing existing media, user must have delete permissions

#### Get Media List

**Endpoint**: `GET /media`

**HTTP Method**: GET

**Description**: Get media list with optional filtering

**Headers**:
```
Content-Type: application/json
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Query Parameters**:
- `format` (enum, optional): Filter by media format - 'video', 'document', 'test', 'event'
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10)

**Response Structure**:
```json
{
  "id": "api.media.list",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": [
    {
      "mediaId": "abc12345-e89b-12d3-a456-426614174000",
      "tenantId": "123e4567-e89b-12d3-a456-426614174000",
      "organisationId": "456e7890-e89b-12d3-a456-426614174000",
      "format": "video",
      "subFormat": "video.youtube",
      "path": "/uploads/media/video-123.mp4",
      "source": "https://youtube.com/watch?v=example",
      "storage": "local",
      "params": {
        "duration": 120,
        "resolution": "720p"
      },
      "createdBy": "789e0123-e89b-12d3-a456-426614174000",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### Get Media by ID

**Endpoint**: `GET /media/{mediaId}`

**HTTP Method**: GET

**Description**: Retrieve a specific media by its ID

**Headers**:
```
Content-Type: application/json
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Path Parameters**:
- `mediaId` (UUID, required): Media ID

**Response Structure**:
```json
{
  "id": "api.media.read",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "mediaId": "abc12345-e89b-12d3-a456-426614174000",
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "organisationId": "456e7890-e89b-12d3-a456-426614174000",
    "format": "video",
    "subFormat": "video.youtube",
    "path": "/uploads/media/video-123.mp4",
    "source": "https://youtube.com/watch?v=example",
    "storage": "local",
    "params": {
      "duration": 120,
      "resolution": "720p"
    },
    "createdBy": "789e0123-e89b-12d3-a456-426614174000",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

#### Associate Media with Lesson

**Endpoint**: `POST /media/{mediaId}/associate/{lessonId}`

**HTTP Method**: POST

**Description**: Associate media with a lesson

**Headers**:
```
Content-Type: application/json
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Path Parameters**:
- `mediaId` (UUID, required): Media ID
- `lessonId` (UUID, required): Lesson ID

**Query Parameters**:
- `userId` (UUID, required): User ID making the association

**Response Structure**:
```json
{
  "id": "api.media.associate",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "message": "Media associated successfully"
  }
}
```

#### Delete Media

**Endpoint**: `DELETE /media/{mediaId}`

**HTTP Method**: DELETE

**Description**: Delete media file

**Headers**:
```
Content-Type: application/json
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Path Parameters**:
- `mediaId` (UUID, required): Media ID

**Query Parameters**:
- `userId` (UUID, required): User ID deleting the media

**Response Structure**:
```json
{
  "id": "api.media.delete",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "message": "Media deleted successfully"
  }
}
```

#### Remove Media Association

**Endpoint**: `DELETE /media/{mediaId}/associate/{lessonId}`

**HTTP Method**: DELETE

**Description**: Remove media association from lesson

**Headers**:
```
Content-Type: application/json
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Path Parameters**:
- `mediaId` (UUID, required): Media ID
- `lessonId` (UUID, required): Lesson ID

**Query Parameters**:
- `userId` (UUID, required): User ID removing the association

**Response Structure**:
```json
{
  "id": "api.media.remove-association",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "message": "Media association removed successfully"
  }
}
```

---

### Enrollments

#### Enroll User

**Endpoint**: `POST /enrollments`

**HTTP Method**: POST

**Description**: Enroll a user for a course

**Headers**:
```
Content-Type: application/json
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Request Parameters**:
- `learnerId` (UUID, required): Learner ID to enroll
- `courseId` (UUID, required): Course ID to enroll in
- `status` (enum, optional): Enrollment status - 'published', 'unpublished', 'archived' (default: 'published')
- `endTime` (string, optional): Enrollment end time (ISO format)
- `unlimitedPlan` (boolean, optional): Whether the plan is unlimited (default: false)
- `beforeExpiryMail` (boolean, optional): Whether to send before expiry mail (default: false)
- `afterExpiryMail` (boolean, optional): Whether to send after expiry mail (default: false)
- `params` (object, optional): Additional parameters (JSON object)
- `enrolledBy` (UUID, optional): User who enrolled the student

**Request Body Example**:
```json
{
  "courseId": "123e4567-e89b-12d3-a456-426614174000",
  "learnerId": "456e7890-e89b-12d3-a456-426614174000",
  "status": "published",
  "endTime": "2024-12-31T23:59:59Z",
  "unlimitedPlan": false,
  "beforeExpiryMail": false,
  "afterExpiryMail": false,
  "params": {
    "priority": "high",
    "notes": "VIP student"
  },
  "enrolledBy": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Query Parameters**:
- `userId` (UUID, required): User ID creating the enrollment

**Response Structure**:
```json
{
  "id": "api.enrollment.create",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 201,
  "result": {
    "enrollmentId": "789e0123-e89b-12d3-a456-426614174000",
    "courseId": "123e4567-e89b-12d3-a456-426614174000",
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "organisationId": "456e7890-e89b-12d3-a456-426614174000",
    "userId": "456e7890-e89b-12d3-a456-426614174000",
    "enrolledOnTime": "2024-01-01T00:00:00Z",
    "endTime": "2024-12-31T23:59:59Z",
    "status": "published",
    "unlimitedPlan": false,
    "beforeExpiryMail": false,
    "afterExpiryMail": false,
    "params": {
      "priority": "high",
      "notes": "VIP student"
    },
    "enrolledBy": "123e4567-e89b-12d3-a456-426614174000",
    "enrolledAt": "2024-01-01T00:00:00Z"
  }
}
```

**Validations and Conditions**:

**Input Validation Rules**:
- `tenantid` header must be present and valid UUID format
- `organisationid` header must be present and valid UUID format
- `learnerId` must be present and valid UUID format
- `courseId` must be present and valid UUID format
- `status` must be one of: 'published', 'unpublished', 'archived' (default: 'published')
- `endTime` must be valid ISO date format and in the future (if provided)
- `unlimitedPlan` must be boolean value (default: false)
- `beforeExpiryMail` must be boolean value (default: false)
- `afterExpiryMail` must be boolean value (default: false)
- `params` must be valid JSON object (if provided)
- `enrolledBy` must be valid UUID format (if provided)
- `userId` query parameter must be present and valid UUID

**Business Logic Conditions**:
- Course must exist and be accessible
- Course must belong to the specified tenant and organization
- Learner must exist and be accessible
- Learner must belong to the specified tenant and organization
- If course requires admin approval, enrollment status must be 'unpublished'
- If course has prerequisites, learner must have completed all prerequisites
- If course has enrollment limits, limit must not be exceeded
- If course is not free, payment must be verified
- If unlimitedPlan is true, endTime should not be set
- If endTime is set, it must be after current time
- Duplicate enrollment should be prevented
- Enrollment creation must be atomic (all-or-nothing)
- Audit trail must be maintained for enrollment

**Authorization Conditions**:
- User must have enrollment permissions for the tenant
- User must have access to the specified organization
- User must have access to the course
- User must have access to the learner
- If enrolling others, user must have admin privileges
- If course requires admin approval, only admin users can approve
- If course is paid, user must have payment permissions

#### Get User Enrollments

**Endpoint**: `GET /enrollments`

**HTTP Method**: GET

**Description**: Get user enrollments with optional filtering

**Headers**:
```
Content-Type: application/json
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Query Parameters**:
- `learnerId` (UUID, optional): Filter by learner ID
- `courseId` (UUID, optional): Filter by course ID
- `status` (enum, optional): Filter by enrollment status - 'published', 'unpublished', 'archived'
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 10)

**Response Structure**:
```json
{
  "id": "api.enrollment.list",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "count": 5,
    "enrollments": [
      {
        "enrollmentId": "789e0123-e89b-12d3-a456-426614174000",
        "courseId": "123e4567-e89b-12d3-a456-426614174000",
        "tenantId": "123e4567-e89b-12d3-a456-426614174000",
        "organisationId": "456e7890-e89b-12d3-a456-426614174000",
        "userId": "456e7890-e89b-12d3-a456-426614174000",
        "enrolledOnTime": "2024-01-01T00:00:00Z",
        "endTime": "2024-12-31T23:59:59Z",
        "status": "published",
        "unlimitedPlan": false,
        "beforeExpiryMail": false,
        "afterExpiryMail": false,
        "params": {
          "priority": "high",
          "notes": "VIP student"
        },
        "enrolledBy": "123e4567-e89b-12d3-a456-426614174000",
        "enrolledAt": "2024-01-01T00:00:00Z"
      }
    ]
  }
}
```

#### Get Enrollment by ID

**Endpoint**: `GET /enrollments/{enrollmentId}`

**HTTP Method**: GET

**Description**: Retrieve a specific enrollment by its ID

**Headers**:
```
Content-Type: application/json
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Path Parameters**:
- `enrollmentId` (UUID, required): Enrollment ID

**Response Structure**:
```json
{
  "id": "api.enrollment.get",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "enrollmentId": "789e0123-e89b-12d3-a456-426614174000",
    "courseId": "123e4567-e89b-12d3-a456-426614174000",
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "organisationId": "456e7890-e89b-12d3-a456-426614174000",
    "userId": "456e7890-e89b-12d3-a456-426614174000",
    "enrolledOnTime": "2024-01-01T00:00:00Z",
    "endTime": "2024-12-31T23:59:59Z",
    "status": "published",
    "unlimitedPlan": false,
    "beforeExpiryMail": false,
    "afterExpiryMail": false,
    "params": {
      "priority": "high",
      "notes": "VIP student"
    },
    "enrolledBy": "123e4567-e89b-12d3-a456-426614174000",
    "enrolledAt": "2024-01-01T00:00:00Z"
  }
}
```

#### Update Enrollment

**Endpoint**: `PUT /enrollments/{enrollmentId}`

**HTTP Method**: PUT

**Description**: Update enrollment details

**Headers**:
```
Content-Type: application/json
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Path Parameters**:
- `enrollmentId` (UUID, required): Enrollment ID

**Request Body**:
```json
{
  "status": "published",
  "endTime": "2024-12-31T23:59:59Z",
  "unlimitedPlan": false,
  "beforeExpiryMail": false,
  "afterExpiryMail": false,
  "params": {
    "priority": "high",
    "notes": "Updated VIP student"
  }
}
```

**Response Structure**:
```json
{
  "id": "api.enrollment.update",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "enrollmentId": "789e0123-e89b-12d3-a456-426614174000",
    "courseId": "123e4567-e89b-12d3-a456-426614174000",
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "organisationId": "456e7890-e89b-12d3-a456-426614174000",
    "userId": "456e7890-e89b-12d3-a456-426614174000",
    "enrolledOnTime": "2024-01-01T00:00:00Z",
    "endTime": "2024-12-31T23:59:59Z",
    "status": "published",
    "unlimitedPlan": false,
    "beforeExpiryMail": false,
    "afterExpiryMail": false,
    "params": {
      "priority": "high",
      "notes": "Updated VIP student"
    },
    "enrolledBy": "123e4567-e89b-12d3-a456-426614174000",
    "enrolledAt": "2024-01-01T00:00:00Z"
  }
}
```

#### Cancel Enrollment

**Endpoint**: `DELETE /enrollments/{enrollmentId}`

**HTTP Method**: DELETE

**Description**: Cancel an enrollment

**Headers**:
```
Content-Type: application/json
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Path Parameters**:
- `enrollmentId` (UUID, required): Enrollment ID

**Response Structure**:
```json
{
  "id": "api.enrollment.cancel",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "success": true,
    "message": "Enrollment cancelled successfully"
  }
}
```

---

### Tracking

#### Get Course Tracking

**Endpoint**: `GET /tracking/course/{courseId}/{userId}`

**HTTP Method**: GET

**Description**: Get course tracking status for a user

**Headers**:
```
Content-Type: application/json
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Path Parameters**:
- `courseId` (UUID, required): Course ID
- `userId` (UUID, required): User ID

**Response Structure**:
```json
{
  "id": "api.tracking.course.get",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "courseTrackId": "789e0123-e89b-12d3-a456-426614174000",
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "organisationId": "456e7890-e89b-12d3-a456-426614174000",
    "courseId": "123e4567-e89b-12d3-a456-426614174000",
    "userId": "456e7890-e89b-12d3-a456-426614174000",
    "startDatetime": "2024-01-01T00:00:00Z",
    "endDatetime": "2024-12-31T23:59:59Z",
    "noOfLessons": 20,
    "completedLessons": 15,
    "status": "incomplete",
    "lastAccessedDate": "2024-01-15T10:30:00Z",
    "certGenDate": "2024-01-20T15:45:00Z"
  }
}
```

#### Start Lesson Attempt

**Endpoint**: `POST /tracking/lesson/attempt/{lessonId}`

**HTTP Method**: POST

**Description**: Start a new lesson attempt or get existing incomplete attempt

**Headers**:
```
Content-Type: application/json
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Path Parameters**:
- `lessonId` (UUID, required): Lesson ID

**Query Parameters**:
- `userId` (UUID, required): User ID

**Response Structure**:
```json
{
  "id": "api.tracking.lesson.attempt.start",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 201,
  "result": {
    "lessonTrackId": "789e0123-e89b-12d3-a456-426614174000",
    "lessonId": "123e4567-e89b-12d3-a456-426614174000",
    "courseId": "456e7890-e89b-12d3-a456-426614174000",
    "userId": "456e7890-e89b-12d3-a456-426614174000",
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "organisationId": "456e7890-e89b-12d3-a456-426614174000",
    "attempt": 1,
    "startDatetime": "2024-01-01T00:00:00Z",
    "endDatetime": null,
    "score": 0,
    "status": "started",
    "totalContent": 100,
    "currentPosition": 0,
    "timeSpent": 0,
    "completionPercentage": 0,
    "params": {
      "quizScore": 0,
      "timeSpent": 0,
      "interactions": 0
    },
    "updatedBy": null,
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

**Validations and Conditions**:

**Input Validation Rules**:
- `lessonId` must be present and valid UUID format
- `userId` query parameter must be present and valid UUID
- `tenantid` header must be present and valid UUID format
- `organisationid` header must be present and valid UUID format

**Business Logic Conditions**:
- Lesson must exist and be accessible
- Lesson must belong to the specified tenant and organization
- User must be enrolled in the course containing the lesson
- If lesson has prerequisites, user must have completed all prerequisite lessons
- If lesson has noOfAttempts limit, user must not have exceeded the limit
- If lesson is already in progress, return existing attempt
- If lesson is completed, return completed attempt
- If lesson is not eligible (prerequisites not met), return not_eligible status
- Course tracking must be updated when lesson attempt starts
- Module tracking must be updated when lesson attempt starts
- Lesson attempt must be atomic (all-or-nothing)
- Audit trail must be maintained for lesson attempts

**Authorization Conditions**:
- User must have access to the lesson
- User must be enrolled in the course
- User must have attempt permissions for the lesson
- If lesson requires payment, user must have paid access
- If lesson is restricted, user must meet access criteria

#### Manage Lesson Attempt

**Endpoint**: `GET /tracking/lesson/attempt/{lessonId}/{userId}`

**HTTP Method**: GET

**Description**: Start over or resume a lesson attempt

**Headers**:
```
Content-Type: application/json
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Path Parameters**:
- `lessonId` (UUID, required): Lesson ID
- `userId` (UUID, required): User ID

**Query Parameters**:
- `action` (enum, required): Action to perform - 'start', 'resume'

**Response Structure**:
```json
{
  "id": "api.tracking.lesson.attempt.manage",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "lessonTrackId": "789e0123-e89b-12d3-a456-426614174000",
    "lessonId": "123e4567-e89b-12d3-a456-426614174000",
    "courseId": "456e7890-e89b-12d3-a456-426614174000",
    "userId": "456e7890-e89b-12d3-a456-426614174000",
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "organisationId": "456e7890-e89b-12d3-a456-426614174000",
    "attempt": 2,
    "startDatetime": "2024-01-01T00:00:00Z",
    "endDatetime": null,
    "score": 0,
    "status": "started",
    "totalContent": 100,
    "currentPosition": 0,
    "timeSpent": 0,
    "completionPercentage": 0,
    "params": {
      "quizScore": 0,
      "timeSpent": 0,
      "interactions": 0
    },
    "updatedBy": null,
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

#### Get Lesson Status

**Endpoint**: `GET /tracking/{lessonId}/users/{userId}/status`

**HTTP Method**: GET

**Description**: Get lesson status for a user

**Headers**:
```
Content-Type: application/json
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Path Parameters**:
- `lessonId` (UUID, required): Lesson ID
- `userId` (UUID, required): User ID

**Response Structure**:
```json
{
  "id": "api.tracking.lesson.status.get",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "canResume": true,
    "canReattempt": false,
    "lastAttemptStatus": "in-progress",
    "lastAttemptId": "attempt_abc123",
    "isEligible": true,
    "requiredLessons": ["lesson_123", "lesson_456"]
  }
}
```

#### Get Attempt Details

**Endpoint**: `GET /tracking/attempts/{attemptId}/{userId}`

**HTTP Method**: GET

**Description**: Get attempt details

**Headers**:
```
Content-Type: application/json
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Path Parameters**:
- `attemptId` (string, required): Attempt ID
- `userId` (UUID, required): User ID

**Response Structure**:
```json
{
  "id": "api.tracking.attempt.get",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "lessonTrackId": "789e0123-e89b-12d3-a456-426614174000",
    "lessonId": "123e4567-e89b-12d3-a456-426614174000",
    "courseId": "456e7890-e89b-12d3-a456-426614174000",
    "userId": "456e7890-e89b-12d3-a456-426614174000",
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "organisationId": "456e7890-e89b-12d3-a456-426614174000",
    "attempt": 1,
    "startDatetime": "2024-01-01T00:00:00Z",
    "endDatetime": "2024-01-01T01:30:00Z",
    "score": 85,
    "status": "completed",
    "totalContent": 100,
    "currentPosition": 100,
    "timeSpent": 5400,
    "completionPercentage": 100,
    "params": {
      "quizScore": 85,
      "timeSpent": 5400,
      "interactions": 25
    },
    "updatedBy": "456e7890-e89b-12d3-a456-426614174000",
    "updatedAt": "2024-01-01T01:30:00Z"
  }
}
```

#### Update Attempt Progress

**Endpoint**: `PATCH /tracking/attempts/progress/{attemptId}`

**HTTP Method**: PATCH

**Description**: Update attempt progress

**Headers**:
```
Content-Type: application/json
tenantid: <tenant-id>
organisationid: <organisation-id>
```

**Path Parameters**:
- `attemptId` (UUID, required): Attempt ID

**Request Body**:
```json
{
  "lessonId": "789e0123-e89b-12d3-a456-426614174000",
  "totalContent": 100,
  "currentPosition": 50,
  "score": 85,
  "completionPercentage": 75,
  "status": "in_progress",
  "timeSpent": 1800,
  "params": {
    "quizScore": 85,
    "timeSpent": 1200,
    "interactions": 15
  }
}
```

**Query Parameters**:
- `userId` (UUID, required): User ID

**Response Structure**:
```json
{
  "id": "api.tracking.attempt.update",
  "ver": "1.0",
  "ts": "2024-01-01T00:00:00Z",
  "params": {
    "resmsgid": "msg-1234567890",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "lessonTrackId": "789e0123-e89b-12d3-a456-426614174000",
    "lessonId": "123e4567-e89b-12d3-a456-426614174000",
    "courseId": "456e7890-e89b-12d3-a456-426614174000",
    "userId": "456e7890-e89b-12d3-a456-426614174000",
    "tenantId": "123e4567-e89b-12d3-a456-426614174000",
    "organisationId": "456e7890-e89b-12d3-a456-426614174000",
    "attempt": 1,
    "startDatetime": "2024-01-01T00:00:00Z",
    "endDatetime": null,
    "score": 85,
    "status": "in_progress",
    "totalContent": 100,
    "currentPosition": 50,
    "timeSpent": 1800,
    "completionPercentage": 75,
    "params": {
      "quizScore": 85,
      "timeSpent": 1200,
      "interactions": 15
    },
    "updatedBy": "456e7890-e89b-12d3-a456-426614174000",
    "updatedAt": "2024-01-01T01:15:00Z"
  }
}

**Validations and Conditions**:

**Input Validation Rules**:
- `attemptId` must be present and valid UUID format
- `lessonId` must be present and valid UUID format
- `totalContent` must be number (if provided)
- `currentPosition` must be number (if provided)
- `score` must be number (if provided)
- `completionPercentage` must be number between 0-100 (if provided)
- `status` must be one of: 'not_started', 'started', 'incomplete', 'completed', 'not_eligible' (if provided)
- `timeSpent` must be non-negative number in seconds (if provided)
- `params` must be valid JSON object (if provided)
- `userId` query parameter must be present and valid UUID

**Business Logic Conditions**:
- Attempt must exist and be accessible
- Attempt must belong to the specified user
- Attempt must belong to the specified tenant and organization
- If completionPercentage is 100, status should be updated to 'completed'
- If status is 'completed', course and module tracking must be updated
- Progress update must be atomic (all-or-nothing)
- Audit trail must be maintained for progress updates
- If lesson is completed, prerequisites for next lessons should be checked
- Time tracking must be accurate and consistent

**Authorization Conditions**:
- User must own the attempt being updated
- User must have access to the lesson
- User must be enrolled in the course
- If updating to completed status, user must have completion permissions
```

---

## Status Codes

- `200 OK`: Request successful
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource conflict
- `422 Unprocessable Entity`: Validation error
- `500 Internal Server Error`: Server error

## Error Codes

- `VALIDATION_ERROR`: Input validation failed
- `RESOURCE_NOT_FOUND`: Requested resource not found
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Insufficient permissions
- `CONFLICT`: Resource conflict
- `INTERNAL_ERROR`: Internal server error

## Rate Limiting

The API implements rate limiting to prevent abuse. Limits are applied per endpoint and user.

## File Upload Limits

File upload limits are **dynamic and configurable per tenant** based on tenant-specific configurations. The system supports the following configurable parameters:

### **Configurable Upload Settings**:
- **Image files**: Size and format limits configurable per tenant
- **Document files**: Size and format limits configurable per tenant  
- **Video files**: Size and format limits configurable per tenant
- **Media files**: Size and format limits configurable per tenant

### **Default Configuration** (from `lms-config.json`):
- **Image files**: 50MB max, formats: JPG, JPG, PNG
- **Document files**: 500MB max, formats: PDF, DOC, DOCX
- **Video files**: 500MB max, formats: MP4, WebM

### **Tenant-Specific Configuration Keys**:
- `image_filesize`: Maximum image file size in MB
- `image_mime_type`: Allowed image MIME types
- `document_filesize`: Maximum document file size in MB
- `document_mime_type`: Allowed document MIME types
- `video_filesize`: Maximum video file size in MB
- `video_mime_type`: Allowed video MIME types
- `courses_upload_path`: Course upload directory path
- `modules_upload_path`: Module upload directory path
- `lessons_upload_path`: Lesson upload directory path
- `lessons_media_upload_path`: Lesson media upload directory path
- `lessons_associated_media_upload_path`: Associated media upload directory path

### **How to Check Current Limits**:
Use the **Get LMS Configuration** endpoint (`GET /config`) to retrieve current tenant-specific file upload limits and allowed formats.

## Multi-tenancy

All endpoints require tenant and organization context for data isolation. The system automatically filters data based on the authenticated user's tenant and organization. 