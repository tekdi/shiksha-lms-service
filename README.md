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

## Getting Started

### Environment Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Update the environment variables in the `.env` file with your configuration.

### Installation

```bash
# Install dependencies
npm install

# Run database migrations
npm run migration:run

# Start the development server
npm run start:dev

.
