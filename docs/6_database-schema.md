---
sidebar_position: 6
---

# Database Schema

## Entities - LMS Management

### Table: courses

| Column Name | Data Type | Constraints |
|-------------|-----------|-------------|
| courseId | uuid | NOT NULL, DEFAULT uuid_generate_v4(), PRIMARY KEY |
| tenantId | uuid | |
| organisationId | uuid | |
| title | character varying | NOT NULL |
| alias | character varying | NOT NULL |
| shortDescription | character varying | |
| description | text | NOT NULL |
| image | character varying | |
| featured | boolean | NOT NULL, DEFAULT false |
| free | boolean | NOT NULL, DEFAULT false |
| certificateTerm | jsonb | |
| certificateId | uuid | |
| startDatetime | timestamp with time zone | |
| endDatetime | timestamp with time zone | |
| adminApproval | boolean | NOT NULL, DEFAULT false |
| autoEnroll | boolean | NOT NULL, DEFAULT false |
| status | character varying | NOT NULL, DEFAULT 'unpublished'::character varying |
| params | jsonb | |
| createdBy | uuid | NOT NULL |
| createdAt | timestamp with time zone | NOT NULL, DEFAULT now() |
| updatedBy | uuid | NOT NULL |
| updatedAt | timestamp with time zone | NOT NULL, DEFAULT now() |
| prerequisites | ARRAY | |
| rewardType | character varying | |
| templateId | uuid | |
| ordering | integer | NOT NULL, DEFAULT 0 |
| certificateGenDateTime | timestamp with time zone | |
| pricing | jsonb | DEFAULT '{}'::jsonb |
| certificateIssueDateTime | timestamp with time zone | |

### Table: modules

| Column Name | Data Type | Constraints |
|-------------|-----------|-------------|
| moduleId | uuid | NOT NULL, DEFAULT uuid_generate_v4(), PRIMARY KEY |
| parentId | uuid | |
| courseId | uuid | NOT NULL |
| tenantId | uuid | NOT NULL |
| organisationId | uuid | NOT NULL |
| title | character varying | NOT NULL |
| image | character varying | |
| startDatetime | timestamp with time zone | |
| endDatetime | timestamp with time zone | |
| badgeTerm | jsonb | |
| badgeId | uuid | |
| ordering | integer | NOT NULL, DEFAULT 0 |
| createdAt | timestamp with time zone | NOT NULL, DEFAULT now() |
| createdBy | uuid | NOT NULL |
| updatedAt | timestamp with time zone | NOT NULL, DEFAULT now() |
| updatedBy | uuid | NOT NULL |
| description | character varying | |
| status | character varying | NOT NULL, DEFAULT 'unpublished'::character varying |
| prerequisites | ARRAY | |

### Table: lessons

| Column Name | Data Type | Constraints |
|-------------|-----------|-------------|
| lessonId | uuid | NOT NULL, DEFAULT uuid_generate_v4(), PRIMARY KEY |
| tenantId | uuid | |
| organisationId | uuid | |
| checkedOut | uuid | |
| checkedOutTime | timestamp with time zone | |
| title | character varying | NOT NULL |
| alias | character varying | |
| status | character varying | NOT NULL, DEFAULT 'unpublished'::character varying |
| description | text | |
| image | character varying | |
| startDatetime | timestamp with time zone | |
| endDatetime | timestamp with time zone | |
| storage | character varying | |
| noOfAttempts | integer | |
| attemptsGrade | character varying | |
| format | character varying | NOT NULL |
| mediaId | uuid | |
| idealTime | integer | |
| resume | boolean | NOT NULL, DEFAULT false |
| totalMarks | integer | |
| passingMarks | integer | |
| params | jsonb | |
| createdAt | timestamp with time zone | NOT NULL, DEFAULT now() |
| createdBy | uuid | NOT NULL |
| updatedAt | timestamp with time zone | NOT NULL, DEFAULT now() |
| updatedBy | uuid | NOT NULL |
| courseId | uuid | |
| moduleId | uuid | |
| sampleLesson | boolean | NOT NULL, DEFAULT false |
| considerForPassing | boolean | NOT NULL, DEFAULT true |
| ordering | integer | |
| prerequisites | ARRAY | |
| allowResubmission | boolean | NOT NULL, DEFAULT false |
| parentId | uuid | |
| subFormat | character varying | |

### Table: course_lessons

| Column Name | Data Type | Constraints |
|-------------|-----------|-------------|
| courseLessonId | uuid | NOT NULL, PRIMARY KEY, DEFAULT uuid_generate_v4() |
| lessonId | uuid | NOT NULL |
| courseId | uuid | NOT NULL |
| moduleId | uuid | |
| tenantId | uuid | |
| organisationId | uuid | |
| freeLesson | boolean | NOT NULL, DEFAULT false |
| considerForPassing | boolean | NOT NULL, DEFAULT true |
| status | character varying | NOT NULL, DEFAULT 'unpublished'::character varying |
| startDatetime | timestamp with time zone | |
| endDatetime | timestamp with time zone | |
| noOfAttempts | integer | |
| attemptsGrade | character varying | |
| eligibilityCriteria | character varying | |
| idealTime | integer | |
| resume | boolean | NOT NULL, DEFAULT false |
| totalMarks | integer | |
| passingMarks | integer | |
| params | jsonb | |
| createdAt | timestamp with time zone | NOT NULL, DEFAULT now() |
| createdBy | uuid | NOT NULL |
| updatedAt | timestamp with time zone | NOT NULL, DEFAULT now() |
| updatedBy | uuid | NOT NULL |

### Table: media

| Column Name | Data Type | Constraints |
|-------------|-----------|-------------|
| mediaId | uuid | NOT NULL, PRIMARY KEY, DEFAULT uuid_generate_v4() |
| format | character varying | NOT NULL |
| subFormat | character varying | |
| orgFilename | character varying | |
| path | character varying | |
| storage | character varying | |
| source | text | |
| params | jsonb | |
| createdAt | timestamp without time zone | NOT NULL, DEFAULT now() |
| createdBy | uuid | NOT NULL |
| updatedAt | timestamp without time zone | NOT NULL, DEFAULT now() |
| updatedBy | uuid | NOT NULL |
| tenantId | uuid | |
| organisationId | uuid | |
| status | character varying | NOT NULL, DEFAULT 'published'::character varying |

### Table: associated_files

| Column Name | Data Type | Constraints |
|-------------|-----------|-------------|
| associatedFilesId | uuid | NOT NULL, PRIMARY KEY, DEFAULT uuid_generate_v4() |
| lessonId | uuid | NOT NULL |
| mediaId | uuid | NOT NULL |
| tenantId | uuid | |
| organisationId | uuid | |
| createdBy | character varying | |
| updatedBy | character varying | |
| createdAt | timestamp without time zone | NOT NULL, DEFAULT now() |
| updatedAt | timestamp without time zone | NOT NULL, DEFAULT now() |

### Table: user_enrollments

| Column Name | Data Type | Constraints |
|-------------|-----------|-------------|
| enrollmentId | uuid | NOT NULL, DEFAULT uuid_generate_v4(), PRIMARY KEY |
| courseId | uuid | NOT NULL |
| tenantId | uuid | NOT NULL |
| organisationId | uuid | |
| userId | uuid | NOT NULL |
| enrolledOnTime | timestamp with time zone | |
| endTime | timestamp with time zone | |
| status | character varying | NOT NULL, DEFAULT 'published'::character varying |
| unlimitedPlan | boolean | NOT NULL, DEFAULT false |
| beforeExpiryMail | boolean | NOT NULL, DEFAULT false |
| afterExpiryMail | boolean | NOT NULL, DEFAULT false |
| params | jsonb | |
| enrolledBy | uuid | NOT NULL |
| enrolledAt | timestamp without time zone | NOT NULL, DEFAULT now() |

### Table: course_track

| Column Name | Data Type | Constraints |
|-------------|-----------|-------------|
| courseTrackId | uuid | NOT NULL, PRIMARY KEY, DEFAULT uuid_generate_v4() |
| courseId | uuid | NOT NULL |
| userId | uuid | NOT NULL |
| startDatetime | timestamp with time zone | |
| endDatetime | timestamp with time zone | |
| noOfLessons | integer | NOT NULL, DEFAULT 0 |
| completedLessons | integer | NOT NULL, DEFAULT 0 |
| status | character varying | NOT NULL, DEFAULT 'incomplete'::character varying |
| lastAccessedDate | timestamp with time zone | |
| certGenDate | timestamp with time zone | |
| tenantId | uuid | NOT NULL |
| organisationId | uuid | NOT NULL |
| certificateIssued | boolean | DEFAULT false |

### Table: lesson_track

| Column Name | Data Type | Constraints |
|-------------|-----------|-------------|
| lessonTrackId | uuid | NOT NULL, PRIMARY KEY, DEFAULT uuid_generate_v4() |
| lessonId | uuid | NOT NULL |
| courseId | uuid | |
| userId | uuid | NOT NULL |
| attempt | integer | NOT NULL, DEFAULT 1 |
| startDatetime | timestamp with time zone | |
| endDatetime | timestamp with time zone | |
| score | integer | DEFAULT 0 |
| status | character varying | NOT NULL, DEFAULT 'started'::character varying |
| totalContent | double precision | NOT NULL, DEFAULT 0 |
| currentPosition | double precision | NOT NULL, DEFAULT 0 |
| timeSpent | integer | DEFAULT 0 |
| updatedBy | uuid | |
| updatedAt | timestamp without time zone | NO, DEFAULT now() |
| tenantId | uuid | |
| organisationId | uuid | |
| params | jsonb | |
| completionPercentage | double precision | DEFAULT 0 |

### Table: module_track

| Column Name | Data Type | Constraints |
|-------------|-----------|-------------|
| moduleTrackId | uuid | NOT NULL, DEFAULT uuid_generate_v4(), PRIMARY KEY |
| moduleId | uuid | NOT NULL |
| userId | uuid | NOT NULL |
| status | character varying | NOT NULL, DEFAULT 'incomplete'::character varying |
| badgeGenDate | timestamp with time zone | |
| tenantId | uuid | NOT NULL |
| organisationId | uuid | NOT NULL |
| completedLessons | integer | NOT NULL, DEFAULT 0 |
| totalLessons | integer | NOT NULL, DEFAULT 0 |
| progress | integer | NOT NULL, DEFAULT 0 |

### Table: migrations

| Column Name | Data Type | Constraints |
|-------------|-----------|-------------|
| id | integer | NOT NULL, PRIMARY KEY, DEFAULT nextval('migrations_id_seq') |
| timestamp | bigint | NOT NULL |
| name | character varying | NOT NULL |
