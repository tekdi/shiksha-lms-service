# Database Structure Documentation

## Table: courses

| Column | Type | Description |
|--------|------|-------------|
| courseId | UUID | Primary key |
| tenantId | UUID | Tenant ID (nullable) |
| organisationId | UUID | Organization ID (nullable) |
| title | VARCHAR(255) | Course title |
| alias | TEXT | Course alias |
| shortDescription | TEXT | Short description of the course (nullable) |
| description | TEXT | Detailed description of the course |
| image | VARCHAR(255) | Course image path (nullable) |
| featured | BOOLEAN | Whether the course is featured (default: FALSE) |
| free | BOOLEAN | Whether the course is free (default: FALSE) |
| certificateTerm | JSONB | Certificate term (nullable) |
| rewardType | VARCHAR(50) | Type of reward for course completion (nullable) - (certificate, badge) |
| templateId | UUID | Template ID for the reward (nullable) |
| prerequisites | UUID[] | Prerequisites for the course - array of prerequisite course IDs (nullable) |
| startDatetime | TIMESTAMPTZ | Course start date and time (nullable) |
| endDatetime | TIMESTAMPTZ | Course end date and time (nullable) |
| adminApproval | BOOLEAN | Whether admin approval is required (default: FALSE) |
| autoEnroll | BOOLEAN | Whether auto-enrollment is enabled (default: FALSE) |
| status | VARCHAR(255) | Course status - (published, unpublished, archived) (default: unpublished) |
| params | JSONB | Additional parameters (nullable) |
| createdBy | UUID | User who created the course |
| createdAt | TIMESTAMPTZ | Creation timestamp |
| updatedBy | UUID | User who last updated the course |
| updatedAt | TIMESTAMPTZ | Last update timestamp |

## Table: modules

| Column | Type | Description |
|--------|------|-------------|
| moduleId | UUID | Primary key |
| parentId | UUID | Foreign key referencing modules (nullable) |
| courseId | UUID | Foreign key referencing courses |
| tenantId | UUID | Tenant ID |
| organisationId | UUID | Organization ID |
| title | VARCHAR(255) | Module title |
| description | VARCHAR | Module description (nullable) |
| image | VARCHAR(255) | Module image path (nullable) |
| startDatetime | TIMESTAMPTZ | Module start date and time (nullable) |
| endDatetime | TIMESTAMPTZ | Module end date and time (nullable) |
| prerequisites | UUID[] | Prerequisites for the module - array of prerequisite module IDs (nullable) |
| badgeTerm | JSONB | Badge term (nullable) |
| badgeId | UUID | Badge ID (nullable) |
| ordering | INTEGER | Module order (default: 0) |
| status | VARCHAR | Module status - (published, unpublished, archived) (default: unpublished) |
| createdAt | TIMESTAMPTZ | Creation timestamp |
| createdBy | UUID | User who created the module |
| updatedAt | TIMESTAMPTZ | Last update timestamp |
| updatedBy | UUID | User who last updated the module |

## Table: lessons

| Column | Type | Description |
|--------|------|-------------|
| lessonId | UUID | Primary key |
| tenantId | UUID | Tenant ID (nullable) |
| organisationId | UUID | Organization ID (nullable) |
| checkedOut | UUID | Checkout user ID (nullable) |
| checkedOutTime | TIMESTAMPTZ | Checkout timestamp (nullable) |
| title | VARCHAR(255) | Lesson title |
| alias | VARCHAR(255) | Lesson alias (nullable) |
| status | VARCHAR(255) | Lesson status - (published, unpublished, archived) (default: unpublished) |
| description | TEXT | Lesson description (nullable) |
| image | VARCHAR(255) | Lesson image path (nullable) |
| startDatetime | TIMESTAMPTZ | Lesson start date (nullable) |
| endDatetime | TIMESTAMPTZ | Lesson end date (nullable) |
| storage | VARCHAR(50) | Storage type (nullable) |
| noOfAttempts | INTEGER | Number of attempts allowed (nullable) |
| attemptsGrade | VARCHAR(255) | Grade calculation method - (first_attempt, last_attempt, average, highest) (nullable) |
| format | VARCHAR(255) | Lesson format - (video, document, test, event, text_and_media) |
| mediaId | UUID | Foreign key referencing Media (nullable) |
| prerequisites | UUID[] | Prerequisites for the lesson - array of prerequisite lesson IDs (nullable) |
| idealTime | INTEGER | Ideal completion time (nullable) |
| resume | BOOLEAN | Whether lesson can be resumed (default: FALSE) |
| totalMarks | INTEGER | Total marks (nullable) |
| passingMarks | INTEGER | Passing marks (nullable) |
| params | JSONB | Additional parameters (nullable) |
| courseId | UUID | Course ID (nullable) |
| moduleId | UUID | Module ID (nullable) |
| sampleLesson | BOOLEAN | Whether this is a sample lesson (default: FALSE) |
| considerForPassing | BOOLEAN | Should consider this lesson for course passing (default: TRUE) |
| ordering | INTEGER | Lesson order (default: 0) |
| createdAt | TIMESTAMPTZ | Creation timestamp |
| createdBy | UUID | User who created the lesson |
| updatedAt | TIMESTAMPTZ | Last update timestamp |
| updatedBy | UUID | User who last updated the lesson |

## Table: media

| Column | Type | Description |
|--------|------|-------------|
| mediaId | UUID | Primary key |
| tenantId | UUID | Tenant ID (nullable) |
| organisationId | UUID | Organization ID (nullable) |
| format | VARCHAR | Media format - (video, document, test, event) |
| subFormat | VARCHAR | Media sub-format (video.youtube, document.pdf, quiz) (nullable) |
| orgFilename | VARCHAR | Original filename (nullable) |
| path | VARCHAR | File path (nullable) |
| storage | VARCHAR | Storage type (nullable) |
| source | TEXT | Media source (nullable) |
| params | JSONB | Additional parameters (nullable) |
| status | VARCHAR | Media status - (published, unpublished, archived) (default: published) |
| createdAt | TIMESTAMPTZ | Creation timestamp |
| createdBy | UUID | User who created the media |
| updatedAt | TIMESTAMPTZ | Last update timestamp |
| updatedBy | UUID | User who last updated the media |

## Table: associated_files

| Column | Type | Description |
|--------|------|-------------|
| associatedFilesId | UUID | Primary key |
| lessonId | VARCHAR | Foreign key referencing lessons |
| mediaId | VARCHAR | Foreign key referencing media |
| tenantId | UUID | Tenant ID (nullable) |
| organisationId | UUID | Organization ID (nullable) |
| createdBy | VARCHAR | User who created the record (nullable) |
| updatedBy | VARCHAR | User who last updated the record (nullable) |
| createdAt | TIMESTAMP | Creation timestamp |
| updatedAt | TIMESTAMP | Last update timestamp |

## Table: user_enrollments

| Column | Type | Description |
|--------|------|-------------|
| enrollmentId | UUID | Primary key |
| courseId | UUID | Foreign key referencing courses |
| tenantId | UUID | Tenant ID |
| organisationId | UUID | Organization ID (nullable) |
| userId | UUID | User ID |
| enrolledOnTime | TIMESTAMPTZ | Enrollment timestamp (nullable) |
| endTime | TIMESTAMPTZ | Enrollment end time (nullable) |
| status | VARCHAR(255) | Enrollments status - (published, unpublished, archived) (default: published) |
| unlimitedPlan | BOOLEAN | Whether unlimited plan (default: FALSE) |
| beforeExpiryMail | BOOLEAN | Whether before expiry mail sent (default: FALSE) |
| afterExpiryMail | BOOLEAN | Whether after expiry mail sent (default: FALSE) |
| params | JSONB | Additional parameters (nullable) |
| enrolledBy | UUID | User who enrolled |
| enrolledAt | TIMESTAMPTZ | Enrollment timestamp |

## Table: course_track

| Column | Type | Description |
|--------|------|-------------|
| courseTrackId | UUID | Primary key |
| tenantId | UUID | Tenant ID |
| organisationId | UUID | Organization ID |
| courseId | UUID | Foreign key referencing courses |
| userId | UUID | User ID |
| startDatetime | TIMESTAMPTZ | Tracking start time (nullable) |
| endDatetime | TIMESTAMPTZ | Tracking end time (nullable) |
| noOfLessons | INTEGER | Total number of lessons (default: 0) |
| completedLessons | INTEGER | Number of completed lessons (default: 0) |
| status | VARCHAR(40) | Course status (default: 'incomplete') - (not_started, started, incomplete, completed, not_eligible) |
| lastAccessedDate | TIMESTAMPTZ | Last accessed date (nullable) |
| certGenDate | TIMESTAMPTZ | Certificate generation date (nullable) |

## Table: module_track

| Column | Type | Description |
|--------|------|-------------|
| moduleTrackId | UUID | Primary key |
| tenantId | UUID | Tenant ID |
| organisationId | UUID | Organization ID |
| moduleId | UUID | Foreign key referencing module |
| userId | UUID | User ID |
| status | VARCHAR(40) | Module status (default: 'incomplete') - (incomplete, completed) |
| completedLessons | INTEGER | Number of completed lessons in the module (default: 0) |
| totalLessons | INTEGER | Total number of lessons in the module (default: 0) |
| progress | INTEGER | Progress percentage (0-100) (default: 0) |
| badgeGenDate | TIMESTAMPTZ | Badge generation date (nullable) |

## Table: lesson_track

| Column | Type | Description |
|--------|------|-------------|
| lessonTrackId | UUID | Primary key |
| lessonId | UUID | Foreign key referencing lessons |
| courseId | UUID | Foreign key referencing course (nullable) |
| userId | UUID | User ID |
| tenantId | UUID | Tenant ID (nullable) |
| organisationId | UUID | Organization ID (nullable) |
| attempt | INTEGER | Attempt number (default: 1) |
| startDatetime | TIMESTAMPTZ | Tracking start time (nullable) |
| endDatetime | TIMESTAMPTZ | Tracking end time (nullable) |
| score | INTEGER | Lesson score (default: 0) (nullable) |
| status | VARCHAR(255) | Lesson status (default: 'started') - (not_started, started, incomplete, completed, not_eligible) |
| totalContent | FLOAT | Total content length (default: 0) |
| currentPosition | FLOAT | Current position (default: 0) |
| timeSpent | INTEGER | Time spent on lesson (default: 0) (nullable) |
| completionPercentage | FLOAT | Completion percentage (default: 0) (nullable) |
| params | JSONB | Additional parameters (nullable) |
| updatedBy | UUID | User who last updated (nullable) |
| updatedAt | TIMESTAMPTZ | Last update timestamp |