# About

The LMS (Learning Management System) microservice is the central backbone of the Shiksha platform, engineered to manage complex educational content hierarchies and track learner progress with high precision. It provides a robust, scalable solution for organizing courses, modules, and lessons, while orchestrating user enrollments and comprehensive progress logic.

Built with **NestJS**, the service adopts a modular, domain-driven architecture that prioritizes developer experience, performance, and security.

## Our Microservice Ecosystem

While the LMS service is highly capable as a standalone engine for content management and tracking, it is designed to operate within a distributed microservice ecosystem:

*   **User/Middleware Service**: Handles authentication (JWT), user identity, and authorization. The LMS service consumes `userId` and `tenantId` from these services to ensure secure data access.
*   **Event Management Service**: Manages the lifecycle of live/offline events (scheduling, attendance). The LMS tracks progress *against* these events but relies on the Event service for administrative controls.
*   **Assessment Service**: Owns the question banks, scoring algorithms, and formal grading logic. The LMS service triggers assessment attempts and stores the final outcomes.
*   **Cloud Storage**: Integrates with providers like AWS S3 or Azure Blob Storage via pluggable modules for persistent media handling (videos, documents, etc.).

## Core Design Principles

### 1. Multi-Tenancy & Data Isolation
The service implements a strict multi-tenant architecture. Using the `@TenantOrg()` decorator, every request is automatically scoped to a specific `tenantid` and `organisationid` header, ensuring 100% data isolation at the database level.

### 2. High-Performance Caching
A Redis-backed caching layer is implemented for read-heavy operations, such as fetching course hierarchies and metadata. This significantly reduces database latency and allows the system to scale to thousands of concurrent learners.

### 3. Event-Driven Awareness
The service is designed to communicate asynchronously via message brokers (e.g., RabbitMQ/Kafka). This enables decoupled workflows like certificate generation, notification triggers, and telemetry sync.

### 4. Visual Excellence in Content
By providing structured, rich-metadata APIs, the LMS service empowers frontend developers to build **premium, dynamic, and responsive learning interfaces** that wow users with smooth transitions and interactive progress visualizations.

