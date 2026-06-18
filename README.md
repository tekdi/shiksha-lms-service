# LMS Microservice

A comprehensive Learning Management System (LMS) microservice built with NestJS. This service provides robust functionality for managing courses, modules, lessons, user enrollments, and progress tracking..

## Features

- **Course Management**: Create, update, and manage courses with customizable attributes
- **Module Management**: Organize courses into modules and submodules
- **Lesson Management**: Create various lesson types (video, document, quiz, event)
- **Media Management**: Upload and associate media with lessons
- **User Enrollment**: Manage user enrollments and access control
- **Progress Tracking**: Track user progress at course, module, and lesson levels
- **Multi-tenancy**: Support for multiple organizations using the same system
- **Internationalization**: Multi-language support

## Tech Stack

- **Framework**: NestJS
- **Database**: PostgreSQL with TypeORM
- **Caching**: Redis
- **Authentication**: JWT-based authentication
- **Documentation**: Swagger/OpenAPI
- **Internationalization**: i18next

## Prerequisites

- Node.js (v14+)
- PostgreSQL (v12+)
- Redis (v6+)
- Optional: Docker and Docker Compose for containerized local setup

## Getting Started

### Environment Setup

1. Create `app/.env` from the checked-in example file.

   PowerShell:
   ```powershell
   Copy-Item app/env.example app/.env
   ```

   Bash:
   ```bash
   cp app/env.example app/.env
   ```

2. Update the environment variables in `app/.env` with your configuration.

### Installation

```bash
cd app

# Install dependencies
npm install

# Create the database if needed, enable uuid-ossp, and run migrations
npm run db:setup

# Start the development server
npm run start:dev
```

### Database Setup

The application uses PostgreSQL with TypeORM migrations. The migration files live in `app/src/migrations`, and the TypeORM data source is configured in `app/typeorm.config.ts`.

Fresh local setup from scratch:
```bash
cd app
npm install
npm run db:setup
```

What `npm run db:setup` does:
- Creates `app/.env` from `app/env.example` if it is missing
- Connects to PostgreSQL using the `DB_*` values in `app/.env`
- Creates the target database if it does not already exist
- Enables the `uuid-ossp` extension
- Runs all pending TypeORM migrations

If you prefer to manage the database manually, create the target database from `app/.env` first and then run the checked-in migrations from the `app` directory.

Migration commands:
```bash
cd app

# Run pending migrations
npm run migration:run

# Generate new migration from entity changes (pass name/path explicitly)
npm run migration:generate -- src/migrations/YourMigrationName

# Revert last migration
npm run migration:revert

# Show migration status
npm run migration:show
```

### Docker Setup

If you want PostgreSQL and Redis locally without installing them directly:

```bash
cd app
docker compose up -d postgres redis
npm install
npm run db:setup
npm run start:dev
```

The application container is also defined in `app/docker-compose.yml`, but for day-to-day development it is usually simpler to run NestJS locally and use Docker only for PostgreSQL and Redis.
