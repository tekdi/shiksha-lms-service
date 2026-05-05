---
sidebar_position: 3
---

# Getting Started

Follow these instructions to set up and run the LMS microservice locally.

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v20 or higher
- **PostgreSQL**: v15 or higher
- **Redis**: v7 or higher
- **Docker**: (Optional, for containerized setup)

### Local Setup

1. **Clone the repository**

```sh
git clone https://github.com/tekdi/shiksha-lms-service

```

2. **Navigate to the application directory**:
   ```bash
   cd shiksha-lms-service/app
   ```
3. **Environment Configuration**:
   Copy the example environment file and update the variables:

   ```bash
   cp env.example .env
   ```

   _Edit `.env` with your local database and redis credentials._

4. **Install Dependencies**:

   ```bash
   npm install
   ```

5. **Database Initialization**:
   Ensure PostgreSQL is running and the database specified in `.env` exists, then run migrations:

   ```bash
   npm run migration:run
   ```

6. **Start the Application**:

   ```bash
   # Development mode with hot-reload
   npm run start:dev

   # Production build
   npm run build
   npm run start:prod
   ```

### Docker Setup

For a quick setup using Docker Compose:

1. **Build and start all services**:

   ```bash
   docker-compose up --build -d
   ```

   This will start the LMS service, PostgreSQL, and Redis in containers.

2. **Verify the installation**:
   The service should be accessible at `http://localhost:4000/api/v1` (or the port specified in your `.env`).
   Access the Swagger documentation at `http://localhost:4000/docs`.
