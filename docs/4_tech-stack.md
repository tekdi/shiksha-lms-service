---
sidebar_position: 7
---

# Tech Stack

The LMS service is built using a modern, scalable technology stack designed for reliability and performance.

### Backend Framework
- **NestJS**: A progressive Node.js framework for building efficient and scalable server-side applications.
- **TypeScript**: Used throughout the project for static typing and enhanced developer productivity.

### Database & Storage
- **PostgreSQL**: The primary relational database for storing course content, user data, and tracking information.
- **TypeORM**: Object-Relational Mapper (ORM) used for database interactions and migration management.
- **Redis**: Used for high-performance caching of frequently accessed data and session management.

### Security
- **JWT (JSON Web Tokens)**: Secure authentication mechanism.
- **Bcrypt**: Used for hashing sensitive data.
- **Passport**: Middleware for authentication strategies.

### Documentation & API
- **Swagger/OpenAPI**: Automated interactive API documentation.
- **Validator/Class-Transformer**: Integrated with NestJS for robust request validation and data transformation.

### DevOps & Infrastructure
- **Docker**: Containerization for consistent development and deployment environments.
- **Docker Compose**: Orchestration for local multi-service environments.
- **Alpine Linux**: Minimalist base images used in Dockerfiles for security and reduced footprint.
