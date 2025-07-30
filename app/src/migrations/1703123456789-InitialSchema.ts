import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1703123456789 implements MigrationInterface {
    name = 'InitialSchema1703123456789'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create courses table
        await queryRunner.query(`
            CREATE TYPE "public"."course_status_enum" AS ENUM('published', 'unpublished', 'archived')
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."reward_type_enum" AS ENUM('certificate', 'badge')
        `);
        await queryRunner.query(`
            CREATE TABLE "courses" (
                "courseId" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "tenantId" uuid,
                "organisationId" uuid,
                "title" character varying(255) NOT NULL,
                "alias" text NOT NULL,
                "shortDescription" text,
                "description" text NOT NULL,
                "image" character varying(255),
                "featured" boolean NOT NULL DEFAULT false,
                "free" boolean NOT NULL DEFAULT false,
                "certificateTerm" jsonb,
                "rewardType" character varying(50),
                "templateId" uuid,
                "eligibilityCriteria" jsonb,
                "startDatetime" TIMESTAMP WITH TIME ZONE,
                "endDatetime" TIMESTAMP WITH TIME ZONE,
                "adminApproval" boolean NOT NULL DEFAULT false,
                "autoEnroll" boolean NOT NULL DEFAULT false,
                "status" character varying(255) NOT NULL DEFAULT 'unpublished',
                "params" jsonb,
                "createdBy" uuid NOT NULL,
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedBy" uuid NOT NULL,
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_courses" PRIMARY KEY ("courseId")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_courses_tenantId" ON "courses" ("tenantId")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_courses_organisationId" ON "courses" ("organisationId")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_courses_title" ON "courses" ("title")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_courses_alias" ON "courses" ("alias")
        `);

        // Create modules table
        await queryRunner.query(`
            CREATE TYPE "public"."module_status_enum" AS ENUM('archived', 'published', 'unpublished')
        `);
        await queryRunner.query(`
            CREATE TABLE "modules" (
                "moduleId" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "parentId" uuid,
                "courseId" uuid NOT NULL,
                "tenantId" uuid NOT NULL,
                "organisationId" uuid NOT NULL,
                "title" character varying(255) NOT NULL,
                "description" character varying,
                "image" character varying(255),
                "startDatetime" TIMESTAMP WITH TIME ZONE,
                "endDatetime" TIMESTAMP WITH TIME ZONE,
                "eligibilityCriteria" character varying(255),
                "badgeTerm" jsonb,
                "badgeId" uuid,
                "ordering" integer NOT NULL DEFAULT '0',
                "status" character varying NOT NULL DEFAULT 'unpublished',
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "createdBy" uuid NOT NULL,
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedBy" uuid NOT NULL,
                CONSTRAINT "PK_modules" PRIMARY KEY ("moduleId")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_modules_parentId" ON "modules" ("parentId")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_modules_courseId" ON "modules" ("courseId")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_modules_tenantId" ON "modules" ("tenantId")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_modules_organisationId" ON "modules" ("organisationId")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_modules_title" ON "modules" ("title")
        `);

        // Create media table
        await queryRunner.query(`
            CREATE TYPE "public"."media_format_enum" AS ENUM('video', 'document', 'test', 'event')
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."media_status_enum" AS ENUM('published', 'unpublished', 'archived')
        `);
        await queryRunner.query(`
            CREATE TABLE "media" (
                "mediaId" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "tenantId" uuid,
                "organisationId" uuid,
                "format" character varying NOT NULL,
                "subFormat" character varying,
                "orgFilename" character varying,
                "path" character varying,
                "storage" character varying,
                "source" text,
                "params" jsonb,
                "status" character varying NOT NULL DEFAULT 'published',
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "createdBy" uuid NOT NULL,
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedBy" uuid NOT NULL,
                CONSTRAINT "PK_media" PRIMARY KEY ("mediaId")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_media_tenantId" ON "media" ("tenantId")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_media_organisationId" ON "media" ("organisationId")
        `);

        // Create lessons table
        await queryRunner.query(`
            CREATE TYPE "public"."lesson_format_enum" AS ENUM('video', 'document', 'test', 'event')
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."lesson_sub_format_enum" AS ENUM('youtube.url', 'pdf', 'quiz', 'event', 'video.url')
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."lesson_status_enum" AS ENUM('unpublished', 'published', 'archived')
        `);
        await queryRunner.query(`
            CREATE TYPE "public"."attempts_grade_method_enum" AS ENUM('first_attempt', 'last_attempt', 'average', 'highest')
        `);
        await queryRunner.query(`
            CREATE TABLE "lessons" (
                "lessonId" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "tenantId" uuid,
                "organisationId" uuid,
                "checkedOut" uuid,
                "checkedOutTime" TIMESTAMP WITH TIME ZONE,
                "title" character varying(255) NOT NULL,
                "alias" character varying(255),
                "status" character varying(255) NOT NULL DEFAULT 'unpublished',
                "description" text,
                "image" character varying(255),
                "startDatetime" TIMESTAMP WITH TIME ZONE,
                "endDatetime" TIMESTAMP WITH TIME ZONE,
                "storage" character varying(50),
                "noOfAttempts" integer,
                "attemptsGrade" character varying(255),
                "format" character varying(255) NOT NULL,
                "mediaId" uuid,
                "eligibilityCriteria" character varying(255),
                "idealTime" integer,
                "resume" boolean NOT NULL DEFAULT false,
                "totalMarks" integer,
                "passingMarks" integer,
                "params" jsonb,
                "courseId" uuid,
                "moduleId" uuid,
                "sampleLesson" boolean NOT NULL DEFAULT false,
                "considerForPassing" boolean NOT NULL DEFAULT true,
                "ordering" integer NOT NULL DEFAULT '0',
                "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "createdBy" uuid NOT NULL,
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updatedBy" uuid NOT NULL,
                CONSTRAINT "PK_lessons" PRIMARY KEY ("lessonId")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_lessons_tenantId" ON "lessons" ("tenantId")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_lessons_organisationId" ON "lessons" ("organisationId")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_lessons_title" ON "lessons" ("title")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_lessons_courseId" ON "lessons" ("courseId")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_lessons_moduleId" ON "lessons" ("moduleId")
        `);

        // Create associated_files table
        await queryRunner.query(`
            CREATE TABLE "associated_files" (
                "associatedFilesId" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "lessonId" character varying NOT NULL,
                "mediaId" character varying NOT NULL,
                "tenantId" uuid,
                "organisationId" uuid,
                "createdBy" character varying,
                "updatedBy" character varying,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_associated_files" PRIMARY KEY ("associatedFilesId")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_associated_files_tenantId" ON "associated_files" ("tenantId")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_associated_files_organisationId" ON "associated_files" ("organisationId")
        `);

        // Create user_enrollments table
        await queryRunner.query(`
            CREATE TYPE "public"."enrollment_status_enum" AS ENUM('published', 'unpublished', 'archived')
        `);
        await queryRunner.query(`
            CREATE TABLE "user_enrollments" (
                "enrollmentId" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "courseId" uuid NOT NULL,
                "tenantId" uuid NOT NULL,
                "organisationId" uuid,
                "userId" uuid NOT NULL,
                "enrolledOnTime" TIMESTAMP WITH TIME ZONE,
                "endTime" TIMESTAMP WITH TIME ZONE,
                "status" character varying(255) NOT NULL DEFAULT 'published',
                "unlimitedPlan" boolean NOT NULL DEFAULT false,
                "beforeExpiryMail" boolean NOT NULL DEFAULT false,
                "afterExpiryMail" boolean NOT NULL DEFAULT false,
                "params" jsonb,
                "enrolledBy" uuid NOT NULL,
                "enrolledAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_user_enrollments" PRIMARY KEY ("enrollmentId")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_user_enrollments_courseId" ON "user_enrollments" ("courseId")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_user_enrollments_tenantId" ON "user_enrollments" ("tenantId")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_user_enrollments_organisationId" ON "user_enrollments" ("organisationId")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_user_enrollments_userId" ON "user_enrollments" ("userId")
        `);

        // Create course_track table
        await queryRunner.query(`
            CREATE TYPE "public"."tracking_status_enum" AS ENUM('started', 'incomplete', 'completed')
        `);
        await queryRunner.query(`
            CREATE TABLE "course_track" (
                "courseTrackId" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "tenantId" uuid NOT NULL,
                "organisationId" uuid NOT NULL,
                "courseId" uuid NOT NULL,
                "userId" uuid NOT NULL,
                "startDatetime" TIMESTAMP WITH TIME ZONE,
                "endDatetime" TIMESTAMP WITH TIME ZONE,
                "noOfLessons" integer NOT NULL DEFAULT '0',
                "completedLessons" integer NOT NULL DEFAULT '0',
                "status" character varying(40) NOT NULL DEFAULT 'incomplete',
                "lastAccessedDate" TIMESTAMP WITH TIME ZONE,
                "certGenDate" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_course_track" PRIMARY KEY ("courseTrackId")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_course_track_tenantId" ON "course_track" ("tenantId")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_course_track_organisationId" ON "course_track" ("organisationId")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_course_track_courseId" ON "course_track" ("courseId")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_course_track_userId" ON "course_track" ("userId")
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_course_track_user_course" ON "course_track" ("userId", "courseId")
        `);

        // Create lesson_track table
        await queryRunner.query(`
            CREATE TABLE "lesson_track" (
                "lessontrackid" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "lessonId" uuid NOT NULL,
                "courseId" uuid,
                "userId" uuid NOT NULL,
                "tenantId" uuid,
                "organisationId" uuid,
                "attempt" integer NOT NULL DEFAULT '1',
                "startDatetime" TIMESTAMP WITH TIME ZONE,
                "endDatetime" TIMESTAMP WITH TIME ZONE,
                "score" integer DEFAULT '0',
                "status" character varying(255) NOT NULL DEFAULT 'started',
                "totalContent" double precision NOT NULL DEFAULT '0',
                "currentPosition" double precision NOT NULL DEFAULT '0',
                "timeSpent" integer,
                "params" jsonb,
                "updatedBy" uuid,
                "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_lesson_track" PRIMARY KEY ("lessontrackid")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_lesson_track_lessonId" ON "lesson_track" ("lessonId")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_lesson_track_courseId" ON "lesson_track" ("courseId")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_lesson_track_userId" ON "lesson_track" ("userId")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_lesson_track_tenantId" ON "lesson_track" ("tenantId")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_lesson_track_organisationId" ON "lesson_track" ("organisationId")
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX "IDX_lesson_track_user_lesson_course_attempt" ON "lesson_track" ("userId", "lessonId", "courseId", "attempt")
        `);

        // Create module_track table
        await queryRunner.query(`
            CREATE TYPE "public"."module_track_status_enum" AS ENUM('incomplete', 'completed')
        `);
        await queryRunner.query(`
            CREATE TABLE "module_track" (
                "moduleTrackId" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "tenantId" uuid NOT NULL,
                "organisationId" uuid NOT NULL,
                "moduleId" uuid NOT NULL,
                "userId" uuid NOT NULL,
                "status" character varying(40) NOT NULL DEFAULT 'incomplete',
                "completedLessons" integer NOT NULL DEFAULT '0',
                "totalLessons" integer NOT NULL DEFAULT '0',
                "progress" integer NOT NULL DEFAULT '0',
                "badgeGenDate" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_module_track" PRIMARY KEY ("moduleTrackId")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_module_track_tenantId" ON "module_track" ("tenantId")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_module_track_organisationId" ON "module_track" ("organisationId")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_module_track_moduleId" ON "module_track" ("moduleId")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_module_track_userId" ON "module_track" ("userId")
        `);

        // Add foreign key constraints
        await queryRunner.query(`
            ALTER TABLE "modules" ADD CONSTRAINT "FK_modules_course" 
            FOREIGN KEY ("courseId") REFERENCES "courses"("courseId") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "modules" ADD CONSTRAINT "FK_modules_parent" 
            FOREIGN KEY ("parentId") REFERENCES "modules"("moduleId") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "lessons" ADD CONSTRAINT "FK_lessons_course" 
            FOREIGN KEY ("courseId") REFERENCES "courses"("courseId") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "lessons" ADD CONSTRAINT "FK_lessons_module" 
            FOREIGN KEY ("moduleId") REFERENCES "modules"("moduleId") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "lessons" ADD CONSTRAINT "FK_lessons_media" 
            FOREIGN KEY ("mediaId") REFERENCES "media"("mediaId") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "associated_files" ADD CONSTRAINT "FK_associated_files_lesson" 
            FOREIGN KEY ("lessonId") REFERENCES "lessons"("lessonId") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "associated_files" ADD CONSTRAINT "FK_associated_files_media" 
            FOREIGN KEY ("mediaId") REFERENCES "media"("mediaId") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "user_enrollments" ADD CONSTRAINT "FK_user_enrollments_course" 
            FOREIGN KEY ("courseId") REFERENCES "courses"("courseId") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "course_track" ADD CONSTRAINT "FK_course_track_course" 
            FOREIGN KEY ("courseId") REFERENCES "courses"("courseId") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "lesson_track" ADD CONSTRAINT "FK_lesson_track_lesson" 
            FOREIGN KEY ("lessonId") REFERENCES "lessons"("lessonId") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "lesson_track" ADD CONSTRAINT "FK_lesson_track_course" 
            FOREIGN KEY ("courseId") REFERENCES "courses"("courseId") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign key constraints
        await queryRunner.query(`ALTER TABLE "lesson_track" DROP CONSTRAINT "FK_lesson_track_course"`);
        await queryRunner.query(`ALTER TABLE "lesson_track" DROP CONSTRAINT "FK_lesson_track_lesson"`);
        await queryRunner.query(`ALTER TABLE "course_track" DROP CONSTRAINT "FK_course_track_course"`);
        await queryRunner.query(`ALTER TABLE "user_enrollments" DROP CONSTRAINT "FK_user_enrollments_course"`);
        await queryRunner.query(`ALTER TABLE "associated_files" DROP CONSTRAINT "FK_associated_files_media"`);
        await queryRunner.query(`ALTER TABLE "associated_files" DROP CONSTRAINT "FK_associated_files_lesson"`);
        await queryRunner.query(`ALTER TABLE "lessons" DROP CONSTRAINT "FK_lessons_media"`);
        await queryRunner.query(`ALTER TABLE "lessons" DROP CONSTRAINT "FK_lessons_module"`);
        await queryRunner.query(`ALTER TABLE "lessons" DROP CONSTRAINT "FK_lessons_course"`);
        await queryRunner.query(`ALTER TABLE "modules" DROP CONSTRAINT "FK_modules_parent"`);
        await queryRunner.query(`ALTER TABLE "modules" DROP CONSTRAINT "FK_modules_course"`);

        // Drop tables
        await queryRunner.query(`DROP TABLE "module_track"`);
        await queryRunner.query(`DROP TABLE "lesson_track"`);
        await queryRunner.query(`DROP TABLE "course_track"`);
        await queryRunner.query(`DROP TABLE "user_enrollments"`);
        await queryRunner.query(`DROP TABLE "associated_files"`);
        await queryRunner.query(`DROP TABLE "lessons"`);
        await queryRunner.query(`DROP TABLE "media"`);
        await queryRunner.query(`DROP TABLE "modules"`);
        await queryRunner.query(`DROP TABLE "courses"`);

        // Drop enums
        await queryRunner.query(`DROP TYPE "public"."module_track_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."tracking_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."enrollment_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."attempts_grade_method_enum"`);
        await queryRunner.query(`DROP TYPE "public"."lesson_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."lesson_sub_format_enum"`);
        await queryRunner.query(`DROP TYPE "public"."lesson_format_enum"`);
        await queryRunner.query(`DROP TYPE "public"."media_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."media_format_enum"`);
        await queryRunner.query(`DROP TYPE "public"."module_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."reward_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."course_status_enum"`);
    }
} 