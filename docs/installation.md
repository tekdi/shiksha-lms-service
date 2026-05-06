---
sidebar_position: 9
---

# Installation

## Prerequisites

Before installing the LMS service, ensure you have the following installed:

- **Node.js**: v20 or higher
- **PostgreSQL**: v15 or higher (v15-alpine is used in Docker)
- **Redis**: Required for caching (v7-alpine is used in Docker)

## Steps to Install Locally for Development

### 1. Clone Git Repository

```sh
git clone https://github.com/tekdi/shiksha-lms-service
cd shiksha-lms-service/app
npm install
```

### 2. Setup DB

Make sure you have PostgreSQL installed and running. Create a database for the LMS service:

```sql
CREATE DATABASE shiksha_lms;
```

#### Database Schema Setup

If you need to set up the database schema manually, you can use the following queries. First, ensure the `uuid-ossp` extension is enabled:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

#### Tables and Constraints

```sql
-- Associated Files
CREATE TABLE public.associated_files (
    "lessonId" uuid NOT NULL,
    "mediaId" uuid NOT NULL,
    "associatedFilesId" uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "tenantId" uuid,
    "organisationId" uuid,
    "createdBy" character varying,
    "updatedBy" character varying,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public.associated_files ADD CONSTRAINT "PK_1a9256c7459cf72cfb9186993d6" PRIMARY KEY ("associatedFilesId");

-- Courses
CREATE TABLE public.courses (
    "courseId" uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "tenantId" uuid,
    "organisationId" uuid,
    title character varying(255) NOT NULL,
    alias character varying(255) NOT NULL,
    "shortDescription" character varying(255),
    description text NOT NULL,
    image character varying(255),
    featured boolean DEFAULT false NOT NULL,
    free boolean DEFAULT false NOT NULL,
    "certificateTerm" jsonb,
    "certificateId" uuid,
    "startDatetime" timestamp with time zone,
    "endDatetime" timestamp with time zone,
    "adminApproval" boolean DEFAULT false NOT NULL,
    "autoEnroll" boolean DEFAULT false NOT NULL,
    status character varying(255) DEFAULT 'unpublished'::character varying NOT NULL,
    params jsonb,
    "createdBy" uuid NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedBy" uuid NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    prerequisites uuid[],
    "rewardType" character varying(50),
    "templateId" uuid,
    ordering integer DEFAULT 0 NOT NULL,
    "certificateGenDateTime" timestamp with time zone,
    pricing jsonb DEFAULT '{}'::jsonb,
    "certificateIssueDateTime" timestamp with time zone
);
ALTER TABLE ONLY public.courses ADD CONSTRAINT "PK_70d5a4a8bfdf595743eb9f81f82" PRIMARY KEY ("courseId");

-- Modules
CREATE TABLE public.modules (
    "moduleId" uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "parentId" uuid,
    "courseId" uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "organisationId" uuid NOT NULL,
    title character varying(255) NOT NULL,
    image character varying(255),
    "startDatetime" timestamp with time zone,
    "endDatetime" timestamp with time zone,
    "badgeTerm" jsonb,
    "badgeId" uuid,
    ordering integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "createdBy" uuid NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedBy" uuid NOT NULL,
    description character varying,
    status character varying DEFAULT 'unpublished'::character varying NOT NULL,
    prerequisites uuid[]
);
ALTER TABLE ONLY public.modules ADD CONSTRAINT "PK_7a5041f222dfb5bddc91bcae0bc" PRIMARY KEY ("moduleId");

-- Lessons
CREATE TABLE public.lessons (
    "lessonId" uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "tenantId" uuid,
    "organisationId" uuid,
    "checkedOut" uuid,
    "checkedOutTime" timestamp with time zone,
    title character varying(255) NOT NULL,
    alias character varying(255),
    status character varying(255) DEFAULT 'unpublished'::character varying NOT NULL,
    description text,
    image character varying(255),
    "startDatetime" timestamp with time zone,
    "endDatetime" timestamp with time zone,
    storage character varying(50),
    "noOfAttempts" integer,
    "attemptsGrade" character varying(255),
    format character varying(255) NOT NULL,
    "mediaId" uuid,
    "idealTime" integer,
    resume boolean DEFAULT false NOT NULL,
    "totalMarks" integer,
    "passingMarks" integer,
    params jsonb,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "createdBy" uuid NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedBy" uuid NOT NULL,
    "courseId" uuid,
    "moduleId" uuid,
    "sampleLesson" boolean DEFAULT false NOT NULL,
    "considerForPassing" boolean DEFAULT true NOT NULL,
    ordering integer,
    prerequisites uuid[],
    "allowResubmission" boolean DEFAULT false NOT NULL,
    "parentId" uuid,
    "subFormat" character varying(255)
);
ALTER TABLE ONLY public.lessons ADD CONSTRAINT "PK_c5909f9f0de05aee83bd37ee5d9" PRIMARY KEY ("lessonId");

-- Course Lessons
CREATE TABLE public.course_lessons (
    "courseLessonId" uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "lessonId" uuid NOT NULL,
    "courseId" uuid NOT NULL,
    "moduleId" uuid,
    "tenantId" uuid,
    "organisationId" uuid,
    "freeLesson" boolean DEFAULT false NOT NULL,
    "considerForPassing" boolean DEFAULT true NOT NULL,
    status character varying(255) DEFAULT 'unpublished'::character varying NOT NULL,
    "startDatetime" timestamp with time zone,
    "endDatetime" timestamp with time zone,
    "noOfAttempts" integer,
    "attemptsGrade" character varying(255),
    "eligibilityCriteria" character varying(255),
    "idealTime" integer,
    resume boolean DEFAULT false NOT NULL,
    "totalMarks" integer,
    "passingMarks" integer,
    params jsonb,
    "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
    "createdBy" uuid NOT NULL,
    "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
    "updatedBy" uuid NOT NULL
);
ALTER TABLE ONLY public.course_lessons ADD CONSTRAINT "PK_a5d9fd789e1079b5c0643efa259" PRIMARY KEY ("courseLessonId");

-- Media
CREATE TABLE public.media (
    "mediaId" uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    format character varying NOT NULL,
    "subFormat" character varying,
    "orgFilename" character varying,
    path character varying,
    storage character varying,
    source text,
    params jsonb,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "createdBy" uuid NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedBy" uuid NOT NULL,
    "tenantId" uuid,
    "organisationId" uuid,
    status character varying DEFAULT 'published'::character varying NOT NULL
);
ALTER TABLE ONLY public.media ADD CONSTRAINT "PK_b59b16ab8334d41fd71dd9c9656" PRIMARY KEY ("mediaId");

-- User Enrollments
CREATE TABLE public.user_enrollments (
    "enrollmentId" uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "courseId" uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    "organisationId" uuid,
    "userId" uuid NOT NULL,
    "enrolledOnTime" timestamp with time zone,
    "endTime" timestamp with time zone,
    status character varying(255) DEFAULT 'published'::character varying NOT NULL,
    "unlimitedPlan" boolean DEFAULT false NOT NULL,
    "beforeExpiryMail" boolean DEFAULT false NOT NULL,
    "afterExpiryMail" boolean DEFAULT false NOT NULL,
    params jsonb,
    "enrolledBy" uuid NOT NULL,
    "enrolledAt" timestamp without time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public.user_enrollments ADD CONSTRAINT "PK_6e3d4d6cedb9e161f56b940803e" PRIMARY KEY ("enrollmentId");

-- Course Track
CREATE TABLE public.course_track (
    "courseTrackId" uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "courseId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    "startDatetime" timestamp with time zone,
    "endDatetime" timestamp with time zone,
    "noOfLessons" integer DEFAULT 0 NOT NULL,
    "completedLessons" integer DEFAULT 0 NOT NULL,
    status character varying(40) DEFAULT 'incomplete'::character varying NOT NULL,
    "lastAccessedDate" timestamp with time zone,
    "certGenDate" timestamp with time zone,
    "tenantId" uuid NOT NULL,
    "organisationId" uuid NOT NULL,
    "certificateIssued" boolean DEFAULT false
);
ALTER TABLE ONLY public.course_track ADD CONSTRAINT "PK_15a2a390231b63bff38e608ad91" PRIMARY KEY ("courseTrackId");

-- Module Track
CREATE TABLE public.module_track (
    "moduleTrackId" uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "moduleId" uuid NOT NULL,
    "userId" uuid NOT NULL,
    status character varying(40) DEFAULT 'incomplete'::character varying NOT NULL,
    "badgeGenDate" timestamp with time zone,
    "tenantId" uuid NOT NULL,
    "organisationId" uuid NOT NULL,
    "completedLessons" integer DEFAULT 0 NOT NULL,
    "totalLessons" integer DEFAULT 0 NOT NULL,
    progress integer DEFAULT 0 NOT NULL
);
ALTER TABLE ONLY public.module_track ADD CONSTRAINT "PK_e64c1064d02d6439f685aca5953" PRIMARY KEY ("moduleTrackId");

-- Lesson Track
CREATE TABLE public.lesson_track (
    lessontrackid uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "lessonId" uuid NOT NULL,
    "courseId" uuid,
    "userId" uuid NOT NULL,
    attempt integer DEFAULT 1 NOT NULL,
    "startDatetime" timestamp with time zone,
    "endDatetime" timestamp with time zone,
    score integer DEFAULT 0,
    status character varying(255) DEFAULT 'started'::character varying NOT NULL,
    "totalContent" double precision DEFAULT '0'::double precision NOT NULL,
    "currentPosition" double precision DEFAULT '0'::double precision NOT NULL,
    "timeSpent" integer,
    "updatedBy" uuid,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "tenantId" uuid,
    "organisationId" uuid,
    params jsonb,
    "completionPercentage" double precision DEFAULT 0
);
ALTER TABLE ONLY public.lesson_track ADD CONSTRAINT "PK_06bb2d7fd63d14ee3b76e7aef2d" PRIMARY KEY (lessontrackid);

-- Migrations
CREATE TABLE public.migrations (
    id SERIAL PRIMARY KEY,
    "timestamp" bigint NOT NULL,
    name character varying NOT NULL
);

-- Foreign Key Constraints
ALTER TABLE ONLY public.lessons ADD CONSTRAINT "FK_16e7969589c0b789d9868782259" FOREIGN KEY ("moduleId") REFERENCES public.modules("moduleId");
ALTER TABLE ONLY public.lessons ADD CONSTRAINT "FK_1a9ff2409a84c76560ae8a92590" FOREIGN KEY ("courseId") REFERENCES public.courses("courseId");
ALTER TABLE ONLY public.user_enrollments ADD CONSTRAINT "FK_4685c4359f8b931b656f23b5545" FOREIGN KEY ("courseId") REFERENCES public.courses("courseId");
ALTER TABLE ONLY public.lesson_track ADD CONSTRAINT "FK_49ae44e49fcd50e4b8f11eeb8f5" FOREIGN KEY ("lessonId") REFERENCES public.lessons("lessonId");
ALTER TABLE ONLY public.associated_files ADD CONSTRAINT "FK_4f01216503959cedc5f9ae4705f" FOREIGN KEY ("lessonId") REFERENCES public.lessons("lessonId");
ALTER TABLE ONLY public.course_lessons ADD CONSTRAINT "FK_596ed2ecd8c2324c49a575ccef6" FOREIGN KEY ("moduleId") REFERENCES public.modules("moduleId");
ALTER TABLE ONLY public.associated_files ADD CONSTRAINT "FK_7783cf491d0eeab4fdc8020dfc9" FOREIGN KEY ("mediaId") REFERENCES public.media("mediaId");
ALTER TABLE ONLY public.modules ADD CONSTRAINT "FK_83489b37212a5a547bde8f89014" FOREIGN KEY ("courseId") REFERENCES public.courses("courseId");
ALTER TABLE ONLY public.course_lessons ADD CONSTRAINT "FK_a4dc7855b148a230609fbf38542" FOREIGN KEY ("courseId") REFERENCES public.courses("courseId");
ALTER TABLE ONLY public.modules ADD CONSTRAINT "FK_a6637494664d871968306442f3b" FOREIGN KEY ("parentId") REFERENCES public.modules("moduleId");
ALTER TABLE ONLY public.course_track ADD CONSTRAINT "FK_bdb9516577ee6965ef499010dac" FOREIGN KEY ("courseId") REFERENCES public.courses("courseId");
ALTER TABLE ONLY public.lesson_track ADD CONSTRAINT "FK_be91552279edb8e236a6b933ba1" FOREIGN KEY ("courseId") REFERENCES public.courses("courseId");
ALTER TABLE ONLY public.course_lessons ADD CONSTRAINT "FK_ccb53c65895d2630172a8497148" FOREIGN KEY ("lessonId") REFERENCES public.lessons("lessonId");
ALTER TABLE ONLY public.lessons ADD CONSTRAINT "FK_ee783444a8d1553bc61fe745c1f" FOREIGN KEY ("mediaId") REFERENCES public.media("mediaId");
```

### 3. Environment Variables

Create a `.env` file in the `app` directory and add the necessary environment variables. You can find a template in `env.example`.

```dotenv
# Server Configuration
PORT=4002
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=root
DB_DATABASE=shiksha_lms
DB_SSLMODE=no-verify

# API Prefix
API_PREFIX=lms-service/v1

# Cache Configuration
CACHE_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
CACHE_DEFAULT_TTL=3600
CACHE_MAX_ITEMS=10000

# External Services (Update these if you have them running)
USER_SERVICE_URL=http://localhost:3002
ASSESSMENT_SERVICE_URL=http://localhost:6000/assessment/v1
EVENT_SERVICE_URL=http://localhost:3001

# Tenant Configuration
TENANT_ID=ef99949b-7f3a-4a5f-806a-e67e683e38f3
LMS_CONFIG_PATH=src/lms-config.json
```

### 4. Run the Application

```sh
npm run start:dev
```

## Docker Configuration

The LMS service can be run using Docker Compose for easier dependency management.

### docker-compose.yml

```yaml
version: '3.8'
services:
  lms:
    build: .
    ports:
      - '4002:4002'
    env_file:
      - .env
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: root
      POSTGRES_DB: shiksha_lms
    ports:
      - '5432:5432'

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'

  # Optional: Elasticsearch for advanced search capabilities
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:7.17.0
    environment:
      - discovery.type=single-node
    ports:
      - '9200:9200'
```

## Steps for Server Side Setup

@TODO
