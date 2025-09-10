# NestJS Framework Training Guide
## Shiksha LMS Microservice

### Table of Contents
1. [Introduction to NestJS](#introduction-to-nestjs)
2. [Project Structure](#project-structure)
3. [Main Application Entry Point](#main-application-entry-point)
4. [App Module - Root Module](#app-module---root-module)
5. [Feature Modules](#feature-modules)
6. [Controllers - API Endpoints](#controllers---api-endpoints)
7. [Services - Business Logic](#services---business-logic)
8. [Dependency Injection](#dependency-injection)
9. [Key Concepts Summary](#key-concepts-summary)

---

## Introduction to NestJS

NestJS is a **progressive Node.js framework** for building efficient and scalable server-side applications. It's built on top of Express.js and uses TypeScript by default.

### Key Features:
- **Modular Architecture** - Organize code into modules
- **Dependency Injection** - Built-in IoC container
- **Decorators** - Metadata-driven programming
- **TypeScript First** - Full TypeScript support
- **Enterprise Ready** - Built for large-scale applications

---

## Project Structure

```
src/
├── main.ts                 # Application entry point
├── app.module.ts          # Root module
├── app.controller.ts      # Root controller
├── app.service.ts         # Root service
├── common/                # Shared utilities
│   ├── decorators/        # Custom decorators
│   ├── dto/              # Common DTOs
│   ├── filters/          # Exception filters
│   ├── interceptors/     # Response transformers
│   └── services/         # Shared services
├── courses/              # Feature module
│   ├── courses.module.ts
│   ├── courses.controller.ts
│   ├── courses.service.ts
│   ├── dto/              # Data Transfer Objects
│   └── entities/         # Database entities
├── lessons/              # Another feature module
├── media/                # Media management module
└── tracking/             # Progress tracking module
```

---

## Main Application Entry Point

**File: `src/main.ts`**

```typescript
import 'reflect-metadata';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  // 1. Create NestJS application instance
  const app = await NestFactory.create(AppModule);
  
  // 2. Set global API prefix
  app.setGlobalPrefix('api/v1');
  
  // 3. Enable CORS for cross-origin requests
  app.enableCors();
  
  // 4. Set global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,        // Strip unknown properties
      transform: true,        // Auto-transform payloads
      forbidNonWhitelisted: false,
    }),
  );
  
  // 5. Set global exception filter
  app.useGlobalFilters(new HttpExceptionFilter(reflector));
  
  // 6. Set global response interceptor
  app.useGlobalInterceptors(new ResponseTransformerInterceptor(reflector));
  
  // 7. Setup Swagger documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Shiksha LMS API')
    .setDescription('API documentation for Shiksha LMS Service')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);
  
  // 8. Start the server
  await app.listen(4000);
  console.log('Application is running on port:4000');
}

bootstrap();
```

### Key Points:
- **`NestFactory.create()`** - Creates the application instance
- **Global Configuration** - Pipes, filters, interceptors applied to all routes
- **Swagger Integration** - Auto-generates API documentation
- **Error Handling** - Global exception handling

---

## App Module - Root Module

**File: `src/app.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CoursesModule } from './courses/courses.module';
import { LessonsModule } from './lessons/lessons.module';
import { MediaModule } from './media/media.module';

@Module({
  imports: [
    // Configuration module (global)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    
    // Feature modules
    CoursesModule,
    LessonsModule,
    MediaModule,
    EnrollmentsModule,
    TrackingModule,
  ],
  controllers: [AppController],  // Root controller
  providers: [AppService],       // Root service
})
export class AppModule {}
```

### Key Concepts:
- **`@Module()`** - Decorator that defines a module
- **`imports`** - Other modules this module depends on
- **`controllers`** - Controllers that belong to this module
- **`providers`** - Services, repositories, etc. that belong to this module
- **`exports`** - Services that other modules can use

---

## Feature Modules

### What is a Module in NestJS?

A module is a class decorated with `@Module()` that groups together related controllers, providers, and other modules. Every NestJS app has at least one root module (AppModule).

### Key Properties in @Module()

#### 1. **imports**
Used to bring in other modules so you can use their providers (services, repositories, etc.) inside the current module. Think of it as importing functionality from another module.

```typescript
@Module({
  imports: [UsersModule], // bring in UsersModule so we can use its providers
})
export class AuthModule {}
```

#### 2. **providers**
Classes that NestJS will create and manage in the dependency injection (DI) container. These are usually services, repositories, helpers. Providers can be injected into controllers or other providers.

```typescript
@Injectable()
export class UsersService {
  findAll() {
    return ['user1', 'user2'];
  }
}

@Module({
  providers: [UsersService], // DI container registers UsersService
})
export class UsersModule {}
```

#### 3. **exports**
Makes certain providers available to other modules that import this module. Without exports, providers are private to the module.

```typescript
@Module({
  providers: [UsersService],
  exports: [UsersService], // make it available outside
})
export class UsersModule {}
```

Now another module can use UsersService:

```typescript
@Module({
  imports: [UsersModule], // get access to UsersService
  providers: [AuthService],
})
export class AuthModule {}
```

### Real Example: UsersModule and AuthModule

```typescript
// users.service.ts
@Injectable()
export class UsersService {
  getUser(id: string) {
    return { id, name: 'John Doe' };
  }
}

// users.module.ts
@Module({
  providers: [UsersService],
  exports: [UsersService], // so AuthModule can use it
})
export class UsersModule {}

// auth.service.ts
@Injectable()
export class AuthService {
  constructor(private usersService: UsersService) {} // DI works because of exports
}

// auth.module.ts
@Module({
  imports: [UsersModule], // brings in UsersService
  providers: [AuthService],
})
export class AuthModule {}
```

### LMS Example: Courses Module

**File: `src/courses/courses.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course } from './entities/course.entity';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

@Module({
  imports: [
    // Register TypeORM entities
    TypeOrmModule.forFeature([
      Course,
      Module,
      Lesson,
      // ... other entities
    ]),
    CommonModule,  // Import shared module
    CacheModule,   // Import cache module
  ],
  controllers: [CoursesController],
  providers: [CoursesService],
  exports: [CoursesService],  // Export service for other modules
})
export class CoursesModule {}
```

### Why do we need them?

- **imports** → to reuse other modules' functionality (like TypeOrmModule, ConfigModule)
- **providers** → to register classes (services, repositories, utils) into NestJS's DI container
- **exports** → to share your providers with other modules

### ✅ In short:
- **imports** → pull in other modules
- **providers** → register services/classes inside your module
- **exports** → allow other modules to use your providers

---

## Controllers - API Endpoints

**File: `src/courses/courses.controller.ts`**

```typescript
import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';

@ApiTags('Courses')  // Swagger documentation
@Controller('courses')  // Base route: /api/v1/courses
export class CoursesController {
  constructor(
    private readonly coursesService: CoursesService,  // Dependency injection
  ) {}

  @Post()  // POST /api/v1/courses
  @ApiOperation({ summary: 'Create a new course' })
  @ApiResponse({ status: 201, description: 'Course created successfully' })
  async create(
    @Body() createCourseDto: CreateCourseDto,  // Request body validation
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string },  // Custom decorator
  ) {
    return this.coursesService.create(createCourseDto, tenantOrg);
  }

  @Get()  // GET /api/v1/courses
  @ApiOperation({ summary: 'Get all courses' })
  async findAll(
    @Query() searchDto: SearchCourseDto,  // Query parameters
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string },
  ) {
    return this.coursesService.findAll(searchDto, tenantOrg);
  }

  @Get(':id')  // GET /api/v1/courses/:id
  @ApiOperation({ summary: 'Get course by ID' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,  // Parameter validation
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string },
  ) {
    return this.coursesService.findOne(id, tenantOrg);
  }
}
```

### Controller Concepts:
- **`@Controller()`** - Defines the base route
- **HTTP Method Decorators** - `@Get()`, `@Post()`, `@Put()`, `@Delete()`
- **Parameter Decorators** - `@Body()`, `@Param()`, `@Query()`
- **Validation** - Automatic DTO validation
- **Swagger Documentation** - Auto-generated API docs

---

## Services - Business Logic

**File: `src/courses/courses.service.ts`**

```typescript
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Course } from './entities/course.entity';
import { CreateCourseDto } from './dto/create-course.dto';

@Injectable()  // Makes this class injectable
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(
    // Inject TypeORM repository
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    
    // Inject other services
    private readonly cacheService: CacheService,
    private readonly helperUtil: HelperUtil,
  ) {}

  async create(
    createCourseDto: CreateCourseDto,
    tenantOrg: { tenantId: string; organisationId: string },
  ): Promise<Course> {
    try {
      // Business logic
      const course = this.courseRepository.create({
        ...createCourseDto,
        tenantId: tenantOrg.tenantId,
        organisationId: tenantOrg.organisationId,
      });

      // Save to database
      const savedCourse = await this.courseRepository.save(course);
      
      // Log success
      this.logger.log(`Course created with ID: ${savedCourse.id}`);
      
      return savedCourse;
    } catch (error) {
      this.logger.error('Error creating course:', error);
      throw new BadRequestException('Failed to create course');
    }
  }

  async findAll(
    searchDto: SearchCourseDto,
    tenantOrg: { tenantId: string; organisationId: string },
  ): Promise<Course[]> {
    // Database query with filters
    const courses = await this.courseRepository.find({
      where: {
        tenantId: tenantOrg.tenantId,
        organisationId: tenantOrg.organisationId,
        // ... other filters
      },
      // ... pagination, sorting
    });

    return courses;
  }

  async findOne(
    id: string,
    tenantOrg: { tenantId: string; organisationId: string },
  ): Promise<Course> {
    const course = await this.courseRepository.findOne({
      where: {
        id,
        tenantId: tenantOrg.tenantId,
        organisationId: tenantOrg.organisationId,
      },
    });

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    return course;
  }
}
```

### Service Concepts:
- **`@Injectable()`** - Marks class as injectable
- **Repository Pattern** - Database access through TypeORM
- **Dependency Injection** - Services injected via constructor
- **Error Handling** - Proper exception throwing
- **Logging** - Built-in logger for debugging

---

## Dependency Injection

NestJS uses **Dependency Injection** to manage dependencies between classes.

### How it works:

1. **Register Provider** (in module):
```typescript
@Module({
  providers: [CoursesService],  // Register service
  exports: [CoursesService],    // Export for other modules
})
```

2. **Inject Dependency** (in constructor):
```typescript
constructor(
  private readonly coursesService: CoursesService,  // Auto-injected
) {}
```

3. **Use in Module**:
```typescript
@Module({
  imports: [CoursesModule],  // Import module that exports service
})
```

### Benefits:
- **Loose Coupling** - Classes don't create their dependencies
- **Testability** - Easy to mock dependencies
- **Maintainability** - Changes in one place affect all usages

---

## Key Concepts Summary

### 1. **Modularity**
- Each feature has its own module
- Modules can import and export services
- Clear separation of concerns

### 2. **Decorators**
- `@Module()` - Defines modules
- `@Controller()` - Defines API endpoints
- `@Injectable()` - Makes classes injectable
- `@Get()`, `@Post()` - HTTP method handlers

### 3. **Dependency Injection**
- Services injected via constructor
- Automatic dependency resolution
- Easy testing and mocking

### 4. **TypeORM Integration**
- Database entities as classes
- Repository pattern for data access
- Automatic query building

### 5. **Validation & Documentation**
- DTOs for request/response validation
- Swagger auto-documentation
- Type safety throughout

### 6. **Error Handling**
- Global exception filters
- Custom exception classes
- Consistent error responses

### 7. **Multi-tenancy**
- Tenant context in all operations
- Data isolation by tenant/organization
- Custom decorators for tenant info

---

## Next Steps for Your Team

1. **Start with Controllers** - Understand how API endpoints work
2. **Learn Services** - Focus on business logic implementation
3. **Explore Modules** - Understand how to organize code
4. **Practice DTOs** - Learn data validation patterns
5. **Database Integration** - Work with TypeORM entities
6. **Error Handling** - Implement proper exception handling
7. **Testing** - Write unit and integration tests

This architecture provides a solid foundation for building scalable, maintainable applications with NestJS!