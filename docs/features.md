---
sidebar_position: 2
---

# Features & Technical Architecture

The Shiksha LMS service is a robust, multi-tenant microservice designed for scalable digital learning management. Below are the key features and their technical implementations.

### 🛠️ Core Technology Stack
- **Backend Framework**: [NestJS](https://nestjs.com/) (Node.js)
- **Database**: [PostgreSQL](https://www.postgresql.org/) with `uuid-ossp` for secure data identification.
- **Caching**: [Redis](https://redis.io/) for high-performance session and content caching.
- **Messaging**: Integrated with **Kafka** or **RabbitMQ** for reliable asynchronous event processing.
- **Storage**: Integrated with `@tekdi/nestjs-cloud-storage` for flexible media management.

---

### 📚 Course & Content Management
- **Hierarchical Structure**: Courses are organized into **Modules** and **Lessons**, supporting infinite nesting for complex curricula.
- **Diverse Lesson Formats**:
  - **Video**: Native support for YouTube, Vimeo, and direct cloud-hosted video URLs.
  - **Document (S3 Integrated)**: Seamless integration with **AWS S3** (or Azure/GCP) for hosting and serving PDFs and other documents safely.
  - **Text & Media**: Rich text content with embedded media support.
- **Reusable & Standalone Lessons**: Lessons can be reused across multiple courses or assigned as standalone learning units.
- **Course Cloning**: Administrative capability to clone entire course hierarchies for rapid template deployment.
- **Administrative Controls**: 
    - **Featured flag** for highlighting key content.
    - **Access Management**: Support for Free and Paid course types.
    - **Enrollment Workflows**: Support for both manual and admin-approved enrollment processes.
    - **Scheduling**: Define start and end schedules for courses and availability windows for lessons.

### 🎯 Assessment & Events (External Integrations)
To provide a complete learning experience, the LMS service integrates with external microservices:
- **Assessment Service**: Powering the `Test` lesson format. It handles formal grading, passing criteria, and detailed score reporting.
- **Event Service**: Required for managing `Event` lessons (both online and offline). 
    - *Note*: The LMS does not have a built-in event creator; an external **event-service** must be installed and configured.
    - **Feedback Integration**: Supports associating feedback forms with specific events.
- **User Service**: Dependencies for fetching and synchronizing learner profile data across the ecosystem.

### 📈 Enrollment & Progress Tracking
- **Granular Data Isolation**: Complete multi-tenancy support using `tenantId` and `organisationId` to ensure data security across different organizations.
- **Advanced Tracking Engine**:
    - Tracks progress at three levels: **Course**, **Module**, and **Lesson**.
    - **Resume Functionality**: Allows learners to pick up exactly where they left off.
    - **Grading Strategies**: Supports multiple attempt-grading methods: *Highest Score*, *Average Score*, *First Attempt*, and *Last Attempt*.
    - **Attempt Limits**: Configure maximum attempts per lesson/quiz.
- **Prerequisite System**: Rigid enforcement of learning paths by requiring completion of specific courses, modules, or lessons before unlocking new content. APIs enforce these rules, returning `403 Forbidden` when requirements are unmet.

### 🏆 Badges & Certificates (Incentives)
The system automates the recognition of learner achievements through event-driven triggers:
- **Module Badges**: Emits a `module.badge.eligible` event upon successful completion of a module.
- **Course Certificates**: Emits a `certificate.eligible` event when certificate eligibility criteria (based on prerequisites or custom rules) are met.
- *Note*: Actual image/PDF generation is handled by external specialized services.

### 🌍 Platform & Scalability
- **Security & User Management**:
    > [!IMPORTANT]
    > **Authentication & Authorization**: The LMS service does **not** have built-in authentication or user registration features. It relies on an external **User/Middleware Service** for identity resolution, RBAC enforcement, and JWT validation.
- **Multi-tenancy**: Native architectural support for isolated data environments.
- **Performance**: Optimized with Redis-based caching strategies for hierarchy lookups and metadata.
- **Globalization**: Built-in support for internationalization (i18n).
- **Security**: Strict data isolation and secure environment configuration via `.env`.
