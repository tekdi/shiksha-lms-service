---
sidebar_position: 6
---

# Database Schema

This document provides a comprehensive overview of the database structure for the LMS service.

## Entities - LMS Management

### Table: courses

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| courseId | uuid | NOT NULL, DEFAULT uuid_generate_v4(), PRIMARY KEY | Unique identifier for the course |
| tenantId | uuid | | Tenant ID for multi-tenancy support |
| organisationId | uuid | | Organization ID for organization-level data isolation |
| title | character varying | NOT NULL | Course title |
| alias | character varying | NOT NULL | Course alias or short name |
| shortDescription | character varying | | A brief summary of the course content |
| description | text | NOT NULL | Detailed description of the course |
| image | character varying | | Path to the course thumbnail image |
| featured | boolean | NOT NULL, DEFAULT false | Whether the course is highlighted as featured |
| free | boolean | NOT NULL, DEFAULT false | Whether the course is free of charge |
| certificateTerm | jsonb | | Configuration for certificate eligibility criteria |
| rewardType | character varying | | Type of reward (e.g., certificate, badge) |
| templateId | uuid | | Template ID for the reward/certificate |
| prerequisites | ARRAY | | List of prerequisite course UUIDs |
| startDatetime | timestamp with time zone | | Course availability start date |
| endDatetime | timestamp with time zone | | Course availability end date |
| adminApproval | boolean | NOT NULL, DEFAULT false | Whether admin approval is required for enrollment |
| autoEnroll | boolean | NOT NULL, DEFAULT false | Whether users are automatically enrolled |
| status | character varying | NOT NULL, DEFAULT 'unpublished' | Course status (published, unpublished, archived) |
| params | jsonb | | Additional flexible course parameters |
| pricing | jsonb | DEFAULT '{}'::jsonb | Pricing and currency information |
| certificateGenDateTime | timestamp with time zone | | Timestamp when certificates were generated |
| certificateIssueDateTime | timestamp with time zone | | Timestamp when certificates were issued |
| ordering | integer | NOT NULL, DEFAULT 0 | Display order of the course |
| createdBy | uuid | NOT NULL | User ID who created the record |
| createdAt | timestamp with time zone | NOT NULL, DEFAULT now() | Record creation timestamp |
| updatedBy | uuid | NOT NULL | User ID who last updated the record |
| updatedAt | timestamp with time zone | NOT NULL, DEFAULT now() | Last update timestamp |

### Table: modules

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| moduleId | uuid | NOT NULL, DEFAULT uuid_generate_v4(), PRIMARY KEY | Unique identifier for the module |
| parentId | uuid | | ID of the parent module (for sub-modules) |
| courseId | uuid | NOT NULL | Foreign key referencing the parent course |
| tenantId | uuid | NOT NULL | Tenant ID |
| organisationId | uuid | NOT NULL | Organization ID |
| title | character varying | NOT NULL | Module title |
| description | character varying | | Brief description of the module |
| image | character varying | | Path to the module thumbnail image |
| startDatetime | timestamp with time zone | | Module availability start date |
| endDatetime | timestamp with time zone | | Module availability end date |
| prerequisites | ARRAY | | List of prerequisite module UUIDs |
| badgeTerm | jsonb | | Configuration for badge eligibility criteria |
| badgeId | uuid | | Template ID for the module badge |
| ordering | integer | NOT NULL, DEFAULT 0 | Display order within the course |
| status | character varying | NOT NULL, DEFAULT 'unpublished' | Module status (published, unpublished, archived) |
| createdBy | uuid | NOT NULL | User ID who created the record |
| createdAt | timestamp with time zone | NOT NULL, DEFAULT now() | Record creation timestamp |
| updatedBy | uuid | NOT NULL | User ID who last updated the record |
| updatedAt | timestamp with time zone | NOT NULL, DEFAULT now() | Last update timestamp |

### Table: lessons

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| lessonId | uuid | NOT NULL, DEFAULT uuid_generate_v4(), PRIMARY KEY | Unique identifier for the lesson |
| tenantId | uuid | | Tenant ID |
| organisationId | uuid | | Organization ID |
| parentId | uuid | | ID of the parent lesson (for structured content) |
| courseId | uuid | | Foreign key referencing the parent course |
| moduleId | uuid | | Foreign key referencing the parent module |
| checkedOut | uuid | | ID of the user who has the lesson checked out for editing |
| checkedOutTime | timestamp with time zone | | Timestamp when the lesson was checked out |
| title | character varying | NOT NULL | Lesson title |
| alias | character varying | | URL-friendly alias |
| status | character varying | NOT NULL, DEFAULT 'unpublished' | Lesson status (published, unpublished, archived) |
| description | text | | Detailed lesson content description |
| image | character varying | | Path to the lesson thumbnail image |
| startDatetime | timestamp with time zone | | Lesson availability start date |
| endDatetime | timestamp with time zone | | Lesson availability end date |
| storage | character varying | | Storage type (e.g., local, s3) |
| noOfAttempts | integer | | Maximum number of attempts allowed |
| allowResubmission | boolean | NOT NULL, DEFAULT false | Whether resubmission is allowed within an attempt |
| attemptsGrade | character varying | | Method to calculate final grade (highest, latest, etc.) |
| format | character varying | NOT NULL | Lesson format (video, document, test, event, text_and_media) |
| subFormat | character varying | | Specific sub-format (youtube, pdf, etc.) |
| mediaId | uuid | | Foreign key referencing the primary media asset |
| idealTime | integer | | Estimated time (in minutes) to complete the lesson |
| resume | boolean | NOT NULL, DEFAULT false | Whether the user can resume from their last position |
| totalMarks | integer | | Total possible marks for the lesson |
| passingMarks | integer | | Minimum marks required to pass |
| sampleLesson | boolean | NOT NULL, DEFAULT false | Whether this lesson is available as a preview |
| considerForPassing | boolean | NOT NULL, DEFAULT true | Whether this lesson's completion is required to pass the course |
| ordering | integer | | Display order within the module |
| prerequisites | ARRAY | | List of prerequisite lesson UUIDs |
| params | jsonb | | Additional lesson-specific parameters |
| createdBy | uuid | NOT NULL | User ID who created the record |
| createdAt | timestamp with time zone | NOT NULL, DEFAULT now() | Record creation timestamp |
| updatedBy | uuid | NOT NULL | User ID who last updated the record |
| updatedAt | timestamp with time zone | NOT NULL, DEFAULT now() | Last update timestamp |

### Table: course_lessons (Association Table)

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| courseLessonId | uuid | NOT NULL, PRIMARY KEY, DEFAULT uuid_generate_v4() | Primary key for the course-lesson mapping |
| lessonId | uuid | NOT NULL | Foreign key referencing the lesson |
| courseId | uuid | NOT NULL | Foreign key referencing the course |
| moduleId | uuid | | Foreign key referencing the module |
| tenantId | uuid | | Tenant ID |
| organisationId | uuid | | Organization ID |
| freeLesson | boolean | NOT NULL, DEFAULT false | Whether this lesson is free within this course |
| considerForPassing | boolean | NOT NULL, DEFAULT true | Whether completion counts toward course progress |
| status | character varying | NOT NULL, DEFAULT 'unpublished' | Status of the lesson within this specific course |
| ordering | integer | | Display order override for this course |
| params | jsonb | | Contextual parameters for this association |
| createdBy | uuid | NOT NULL | Created by user ID |
| createdAt | timestamp with time zone | NOT NULL, DEFAULT now() | Created at timestamp |
| updatedBy | uuid | NOT NULL | Updated by user ID |
| updatedAt | timestamp with time zone | NOT NULL, DEFAULT now() | Updated at timestamp |

### Table: media

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| mediaId | uuid | NOT NULL, PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique identifier for the media asset |
| tenantId | uuid | | Tenant ID |
| organisationId | uuid | | Organization ID |
| format | character varying | NOT NULL | Media format (video, document, etc.) |
| subFormat | character varying | | Specific file sub-format (e.g., video.youtube) |
| orgFilename | character varying | | Original name of the uploaded file |
| path | character varying | | Accessible path or key to the file |
| storage | character varying | | Storage provider (local, s3) |
| source | text | | External source URL (if applicable) |
| status | character varying | NOT NULL, DEFAULT 'published' | Media availability status |
| params | jsonb | | Technical metadata (duration, resolution, etc.) |
| createdBy | uuid | NOT NULL | User ID who created the record |
| createdAt | timestamp | NOT NULL, DEFAULT now() | Record creation timestamp |
| updatedBy | uuid | NOT NULL | User ID who last updated the record |
| updatedAt | timestamp | NOT NULL, DEFAULT now() | Last update timestamp |

### Table: associated_files

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| associatedFilesId | uuid | NOT NULL, PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique identifier for the file association |
| lessonId | uuid | NOT NULL | Foreign key referencing the lesson |
| mediaId | uuid | NOT NULL | Foreign key referencing the media asset |
| tenantId | uuid | | Tenant ID |
| organisationId | uuid | | Organization ID |
| createdBy | character varying | | User ID who created the record |
| updatedBy | character varying | | User ID who last updated the record |
| createdAt | timestamp | NOT NULL, DEFAULT now() | Record creation timestamp |
| updatedAt | timestamp | NOT NULL, DEFAULT now() | Last update timestamp |

### Table: user_enrollments

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| enrollmentId | uuid | NOT NULL, DEFAULT uuid_generate_v4(), PRIMARY KEY | Unique identifier for the enrollment |
| courseId | uuid | NOT NULL | ID of the course the user is enrolled in |
| tenantId | uuid | NOT NULL | Tenant ID |
| organisationId | uuid | | Organization ID |
| userId | uuid | NOT NULL | ID of the enrolled user |
| enrolledBy | uuid | NOT NULL | ID of the user who performed the enrollment |
| enrolledAt | timestamp | NOT NULL, DEFAULT now() | Timestamp of initial enrollment |
| enrolledOnTime | timestamp with time zone | | Timestamp when enrollment actually started |
| endTime | timestamp with time zone | | Expiration timestamp for the enrollment |
| status | character varying | NOT NULL, DEFAULT 'published' | Enrollment status (published, archived, etc.) |
| unlimitedPlan | boolean | NOT NULL, DEFAULT false | Whether the user has unlimited access duration |
| beforeExpiryMail | boolean | NOT NULL, DEFAULT false | Whether a pre-expiry notification was sent |
| afterExpiryMail | boolean | NOT NULL, DEFAULT false | Whether a post-expiry notification was sent |
| params | jsonb | | Additional enrollment metadata |

### Table: course_track

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| courseTrackId | uuid | NOT NULL, PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique identifier for course progress tracking |
| tenantId | uuid | NOT NULL | Tenant ID |
| organisationId | uuid | NOT NULL | Organization ID |
| courseId | uuid | NOT NULL | ID of the course being tracked |
| userId | uuid | NOT NULL | ID of the user whose progress is being tracked |
| status | character varying | NOT NULL, DEFAULT 'incomplete' | Progress status (started, completed, etc.) |
| noOfLessons | integer | NOT NULL, DEFAULT 0 | Total lessons in the course at start |
| completedLessons | integer | NOT NULL, DEFAULT 0 | Number of lessons successfully completed |
| startDatetime | timestamp with time zone | | Timestamp when the user started the course |
| endDatetime | timestamp with time zone | | Timestamp when the user completed the course |
| lastAccessedDate | timestamp with time zone | | Timestamp of the user's last interaction |
| certGenDate | timestamp with time zone | | Date the certificate was generated |
| certificateIssued | boolean | DEFAULT false | Whether the certificate has been issued to the user |

### Table: module_track

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| moduleTrackId | uuid | NOT NULL, DEFAULT uuid_generate_v4(), PRIMARY KEY | Unique identifier for module progress tracking |
| tenantId | uuid | NOT NULL | Tenant ID |
| organisationId | uuid | NOT NULL | Organization ID |
| moduleId | uuid | NOT NULL | ID of the module being tracked |
| userId | uuid | NOT NULL | ID of the user whose progress is being tracked |
| status | character varying | NOT NULL, DEFAULT 'incomplete' | Module progress status |
| totalLessons | integer | NOT NULL, DEFAULT 0 | Total lessons within the module |
| completedLessons | integer | NOT NULL, DEFAULT 0 | Completed lessons within the module |
| progress | integer | NOT NULL, DEFAULT 0 | Calculated progress percentage (0-100) |
| badgeGenDate | timestamp with time zone | | Date the module badge was generated |

### Table: lesson_track

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| lessonTrackId | uuid | NOT NULL, PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique identifier for lesson attempt tracking |
| tenantId | uuid | | Tenant ID |
| organisationId | uuid | | Organization ID |
| lessonId | uuid | NOT NULL | ID of the lesson being attempted |
| courseId | uuid | | Contextual course ID |
| userId | uuid | NOT NULL | ID of the user making the attempt |
| attempt | integer | NOT NULL, DEFAULT 1 | Current attempt number |
| status | character varying | NOT NULL, DEFAULT 'started' | Attempt status (completed, in-progress, etc.) |
| score | integer | DEFAULT 0 | Score achieved in the attempt |
| completionPercentage | double precision | DEFAULT 0 | Percentage of content consumed |
| totalContent | double precision | NOT NULL, DEFAULT 0 | Total digestible content length |
| currentPosition | double precision | NOT NULL, DEFAULT 0 | Last saved position in the content |
| timeSpent | integer | DEFAULT 0 | Total time spent in seconds |
| startDatetime | timestamp with time zone | | Timestamp when the attempt started |
| endDatetime | timestamp with time zone | | Timestamp when the attempt was finalized |
| params | jsonb | | Detailed interaction data (quiz responses, etc.) |
| updatedAt | timestamp | DEFAULT now() | Last update timestamp |
| updatedBy | uuid | | ID of the user who last triggered an update |

### Table: migrations

| Column Name | Data Type | Constraints | Description |
|-------------|-----------|-------------|-------------|
| id | integer | NOT NULL, PRIMARY KEY, DEFAULT nextval('migrations_id_seq') | ID of the migration |
| timestamp | bigint | NOT NULL | Unix timestamp of the migration |
| name | character varying | NOT NULL | Descriptive name of the migration |
