---
sidebar_position: 7
---

# API Docs

The LMS service exposes a RESTful API for managing educational content and tracking. All endpoints require `tenantid` and `organisationid` headers for data isolation.

## 1. Modules (Course Management)

These APIs manage the top-level course structure.

**1. Create Course**

- **Method**: `POST`
- **URL**: `/lms-service/v1/courses`
- **Description**: Creates a new course/module.
- **Request Headers:**

```json
{
  "method": "POST",
  "url": "http://localhost:4002/lms-service/v1/courses",
  "pathParams": {},
  "queryParams": {},
  "headers": {
    "accept": "application/json",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {
    "title": "Aspire Leaders Program II",
    "startDatetime": "2025-06-09T00:00:00Z",
    "endDatetime": "2025-07-09T00:00:00Z",
    "shortDescription": "Aspire Leaders Program",
    "description": "The Aspire Leaders Program vinayak",
    "image": "/uploads/image/vinayak.png",
    "status": "published",
    "certificateTerm": {
      "term": "COMPLETE_ALL"
    },
    "certificateId": "uuid",
    "params": {
      "cohortId": "380340b5-f419-4d9b-bac2-cb765ab89070"
    }
  }
}
```

- **Response:**

```json
{
  "id": "api.course.clone",
  "ver": "1.0",
  "ts": "2025-08-11T06:06:19.896Z",
  "params": {
  "resmsgid": "msg-877706-1754892379896",
  "status": "successful",
  "err": null,
  "errmsg": null
  },
  "responseCode": 201,
  "result": {
  "courseId": "98b835f1-b1d8-44b8-a4ce-c8bae1fa3adb",
  "tenantId": "ef99949b-7f3a-4a5f-806a-e67e683e38f3",
  "organisationId": "d36d9079-0f42-4ba3-be03-26c9e79509ee",
  "title": "Test Module (Copy)",
  "alias": "test-module-copy",
  "shortDescription": "",
  "description": "<p>Hello Everyone</p>",
  "image": null,
  "featured": false,
  "free": false,
  "certificateTerm": null,
  "rewardType": null,
  "templateId": null,
  "prerequisites": [],
  "startDatetime": null,
  "endDatetime": null,
  "adminApproval": false,
  "autoEnroll": false,
  "status": "unpublished",
  "params": {
  "cohortId": "46477334-be0f-4a8d-95ca-a34b04c2b5ca"
  },
  "createdBy": "35113bfc-adce-47fc-b85d-871cbcb00bcc",
  "createdAt": "2025-08-07T06:58:58.416Z",
  "updatedBy": "35113bfc-adce-47fc-b85d-871cbcb00bcc",
  "updatedAt": "2025-08-07T06:58:58.416Z"
  }
  }


```

**2. Search Courses**

- **Method**: `GET`
- **URL**: `/lms-service/v1/courses/search`
- **Description**: Search and filter courses.
- **Request Headers:**

```json
{
  "method": "GET",
  "url": "http://localhost:4002/lms-service/v1/courses/search",
  "pathParams": {},
  "queryParams": {
    "page": 1,
    "limit": 10,
    "status": "published",
    "query": "vinayak",
    "cohortId": "380340b5-f419-4d9b-bac2-cb765ab89070"
  },
  "headers": {
    "tenantid": "ef99949b-7f3a-4a5f-806a-e67e683e38f3",
    "organisationid": "d36d9079-0f42-4ba3-be03-26c9e79509ee",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {}
}
```

- **Response:**

```json
{
"id": "api.course.search",
"ver": "1.0",
"ts": "2025-06-17T10:35:12.824Z",
"params": {
"resmsgid": "msg-118973-1750156512824",
"status": "successful",
"err": null,
"errmsg": null
},
"responseCode": 200,
"result": {
"items": [
{
"courseId": "dc5fc5cf-f44a-40c0-849c-1f4c553a5a42",
"tenantId": "ef99949b-7f3a-4a5f-806a-e67e683e38f3",
"organisationId": "d36d9079-0f42-4ba3-be03-26c9e79509ee",
"title": "The Aspire Leaders Program",
"alias": "the-aspire-leaders-program",
"shortDescription": "Applications for Cohort 4 of the 2025 program are open now until July 9, 2025 at 11:59 P.M. EST! Visit this link to apply: Apply Here",
"description": "The Aspire Leaders Program welcomes limited-income and first-generation university students and recent graduates from around the world to join a free online interactive leadership development journey that is manageable along your other commitments. *Note program content is delivered in English.",
"image": null,
"featured": false,
"free": false,
"certificateTerm": null,
"certificateId": null,
"startDatetime": "2025-06-09T00:00:00.000Z",
"endDatetime": "2025-07-09T00:00:00.000Z",
"adminApproval": false,
"autoEnroll": false,
"status": "published",
"params": {},
"createdBy": "100ba777-ca99-4cea-8ec7-c1ddd763d97b",
"createdAt": "2025-06-13T12:12:05.050Z",
"updatedBy": "100ba777-ca99-4cea-8ec7-c1ddd763d97b",
"updatedAt": "2025-06-13T12:12:05.050Z"
}
],
"total": 1
}
}


```

**3. Get Course By Id**

- **Method**: `GET`
- **URL**: `/lms-service/v1/courses/{courseId}`
- **Request Headers:**

```json
{
  "method": "GET",
  "url": "http://localhost:4002/lms-service/v1/courses/{courseId}",
  "pathParams": {
    "courseId": "380340b5-f419-4d9b-bac2-cb765ab89070"
  },
  "queryParams": {},
  "headers": {
    "tenantid": "ef99949b-7f3a-4a5f-806a-e67e683e38f3",
    "organisationid": "d36d9079-0f42-4ba3-be03-26c9e79509ee",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {}
}
```

- **Response:**

```json
{
"id": "api.course.read",
"ver": "1.0",
"ts": "2025-06-17T08:14:41.923Z",
"params": {
"resmsgid": "msg-166491-1750148081923",
"status": "successful",
"err": null,
"errmsg": null
},
"responseCode": 200,
"result": {
"courseId": "380340b5-f419-4d9b-bac2-cb765ab89070",
"tenantId": "ef99949b-7f3a-4a5f-806a-e67e683e38f3",
"organisationId": "d36d9079-0f42-4ba3-be03-26c9e79509ee",
"title": "Module 1 - Personal & Professional Development",
"alias": "module-1-personal-professional-development-982",
"shortDescription": "megha",
"description": "The Aspire Leaders Program vinayak",
"image": "/uploads/courses/7c5vnayak.png",
"featured": false,
"free": false,
"certificateTerm": null,
"certificateId": null,
"startDatetime": "2025-06-09T00:00:00.000Z",
"endDatetime": "2025-07-09T00:00:00.000Z",
"adminApproval": false,
"autoEnroll": false,
"status": "unpublished",
"params": {
"cohortId": "380340b5-f419-4d9b-bac2-cb765ab89070"
},
"createdBy": "100ba777-ca99-4cea-8ec7-c1ddd763d97b",
"createdAt": "2025-06-17T06:38:59.111Z",
"updatedBy": "100ba777-ca99-4cea-8ec7-c1ddd763d97b",
"updatedAt": "2025-06-17T07:39:12.345Z"
}
}
```

**4. Update Course**

- **Method**: `PATCH`
- **URL**: `/lms-service/v1/courses/{courseId}`
- **Request Headers:**

```json
{
  "method": "PATCH",
  "url": "http://localhost:4002/lms-service/v1/courses/{courseId}",
  "pathParams": {
    "courseId": "18c13a95-b447-473f-a0d8-10a0ebcb263c"
  },
  "queryParams": {},
  "headers": {
    "tenantid": "ef99949b-7f3a-4a5f-806a-e67e683e38f3",
    "organisationid": "d36d9079-0f42-4ba3-be03-26c9e79509ee",
    "Content-Type": "application/json",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {
    "title": "Module 1 - Personal & Professional Development",
    "status": "published",
    "params": {
      "cohortId": "380340b5-f419-4d9b-bac2-cb765ab89070"
    }
  }
}
```

- **Response:**

```json
{
"id": "api.course.update",
"ver": "1.0",
"ts": "2025-06-17T10:56:00.391Z",
"params": {
"resmsgid": "msg-716387-1750157760391",
"status": "successful",
"err": null,
"errmsg": null
},
"responseCode": 200,
"result": {
"courseId": "18c13a95-b447-473f-a0d8-10a0ebcb263c",
"tenantId": "ef99949b-7f3a-4a5f-806a-e67e683e38f3",
"organisationId": "d36d9079-0f42-4ba3-be03-26c9e79509ee",
"title": "Module 1 - Personal & Professional Development",
"alias": "module-1-personal-professional-development",
"shortDescription": "Aspire Leaders Program",
"description": "The Aspire Leaders Program vinayak",
"image": "/uploads/image/vinayak.png",
"featured": false,
"free": false,
"certificateTerm": {
"term": {
"term": "COMPLETE_ALL"
}
},
"certificateId": "380340b5-f419-4d9b-bac2-cb765ab89070",
"startDatetime": "2025-06-09T00:00:00.000Z",
"endDatetime": "2025-07-09T00:00:00.000Z",
"adminApproval": false,
"autoEnroll": false,
"status": "published",
"params": {
"cohortId": "380340b5-f419-4d9b-bac2-cb765ab89070"
},
"createdBy": "35113bfc-adce-47fc-b85d-871cbcb00bcc",
"createdAt": "2025-06-17T10:52:55.621Z",
"updatedBy": "35113bfc-adce-47fc-b85d-871cbcb00bcc",
"updatedAt": "2025-06-17T10:56:00.386Z"
}
}
```

**5. Delete Course**

- **Method**: `DELETE`
- **URL**: `/lms-service/v1/courses/{courseId}`
- **Description**: Soft deletes/archives a course.
- **Request Headers:**

```json
{
  "method": "DELETE",
  "url": "http://localhost:4002/lms-service/v1/courses/{courseId}",
  "pathParams": {
    "courseId": "18c13a95-b447-473f-a0d8-10a0ebcb263c"
  },
  "queryParams": {},
  "headers": {
    "tenantid": "ef99949b-7f3a-4a5f-806a-e67e683e38f3",
    "organisationid": "d36d9079-0f42-4ba3-be03-26c9e79509ee",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {}
}
```

- **Response:**

```json
{
"id": "api.course.delete",
"ver": "1.0",
"ts": "2025-06-17T08:15:16.216Z",
"params": {
"resmsgid": "msg-662469-1750148116216",
"status": "successful",
"err": null,
"errmsg": null
},
"responseCode": 200,
"result": {
"success": true,
"message": "Course deleted successfully"
}
}

```

**6. Clone Course**

- **Method**: `POST`
- **URL**: `/lms-service/v1/courses/{courseId}/clone`
- **Description**: Creates a copy of an existing course.
- **Request Headers:**

```json
{
  "method": "POST",
  "url": "http://localhost:4002/lms-service/v1/courses/{courseId}/clone",
  "pathParams": {
    "moduleId": "05e949e8-71c4-4f8b-a4c2-04f2fb613702"
  },
  "queryParams": {},
  "headers": {
    "tenantid": "ef99949b-7f3a-4a5f-806a-e67e683e38f3",
    "organisationid": "d36d9079-0f42-4ba3-be03-26c9e79509ee",
    "Content-Type": "application/json",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {
    "newCourseId": "98b835f1-b1d8-44b8-a4ce-c8bae1fa3adb"
  }
}
```

- **Response:**

```json
{
"id": "api.module.clone",
"ver": "1.0",
"ts": "2025-08-11T06:23:54.728Z",
"params": {
"resmsgid": "msg-553170-1754893434728",
"status": "successful",
"err": null,
"errmsg": null
},
"responseCode": 201,
"result": {
"moduleId": "99e371f5-69b5-4b1f-a025-a8d8e86f048a",
"parentId": null,
"courseId": "98b835f1-b1d8-44b8-a4ce-c8bae1fa3adb",
"tenantId": "ef99949b-7f3a-4a5f-806a-e67e683e38f3",
"organisationId": "d36d9079-0f42-4ba3-be03-26c9e79509ee",
"title": "Week 1 - Discover",
"description": "<section style='font-family: Manrope, Arial, sans-serif; max-width: 800px; margin: 20px auto; padding: 20px; background-color: #fafafa; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.05);'><ul style='list-style-type: square; padding-left: 20px; color: #434343; font-size: 14px; line-height: 1.5; margin: 0;'><li style='margin-bottom: 12px;'>Access your Discord Group to begin global peer-to-peer networking.</li><li style='margin-bottom: 12px;'>Take the strengths-based leadership skills assessment to understand yourself as a leader.</li><li style='margin-bottom: 12px;'>Complete personal reflection prompts and community discussion posts to enrich your learning experience.</li></ul></section>",
"image": "lms/modules/week1.png",
"startDatetime": null,
"endDatetime": null,
"prerequisites": null,
"badgeTerm": null,
"badgeId": null,
"ordering": 1,
"status": "published",
"createdAt": "2025-07-11T11:42:53.577Z",
"createdBy": "35113bfc-adce-47fc-b85d-871cbcb00bcc",
"updatedAt": "2025-07-15T08:46:39.345Z",
"updatedBy": "35113bfc-adce-47fc-b85d-871cbcb00bcc"
}
}

## 2. Units (Unit Management)

These APIs manage nested units within courses.


```

**1. Create Unit**

- **Method**: `POST`
- **URL**: `/lms-service/v1/modules`
- **Request Headers:**

```json
{
  "method": "POST",
  "url": "http://localhost:4002/lms-service/v1/modules",
  "pathParams": {},
  "queryParams": {},
  "headers": {
    "tenantid": "ef99949b-7f3a-4a5f-806a-e67e683e38f3",
    "organisationid": "d36d9079-0f42-4ba3-be03-26c9e79509ee",
    "Content-Type": "multipart/form-data",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {
    "title": "Week 2 - Discover",
    "alias": "intro-html",
    "courseId": "18c13a95-b447-473f-a0d8-10a0ebcb263c",
    "description": "Week 2 June 4th - June 10th Let's get started! This week is all about building critical professional skills to boost your career journey! There are 5 steps to complete in this Week.",
    "image": "/uploads/module/vinayak.png",
    "ordering": 1,
    "status": "published"
  }
}
```

- **Response:**

```json
{
"id": "api.module.create",
"ver": "1.0",
"ts": "2025-06-17T08:17:14.528Z",
"params": {
"resmsgid": "msg-356084-1750148234528",
"status": "successful",
"err": null,
"errmsg": null
},
"responseCode": 201,
"result": {
"moduleId": "bf7942f1-138b-475f-8c1c-416ae93fd811",
"parentId": null,
"courseId": "380340b5-f419-4d9b-bac2-cb765ab89070",
"tenantId": "ef99949b-7f3a-4a5f-806a-e67e683e38f3",
"organisationId": "d36d9079-0f42-4ba3-be03-26c9e79509ee",
"title": "Week 2 - Discover",
"description": "Week 2 June 4th - June 10th Let's get started! This week is all about building critical professional skills to boost your career journey! There are 5 steps to complete in this Week.",
"image": null,
"startDatetime": null,
"endDatetime": null,
"eligibilityCriteria": null,
"badgeTerm": null,
"badgeId": null,
"ordering": 0,
"status": "published",
"createdAt": "2025-06-17T08:17:14.507Z",
"createdBy": "100ba777-ca99-4cea-8ec7-c1ddd763d97b",
"updatedAt": "2025-06-17T08:17:14.507Z",
"updatedBy": "100ba777-ca99-4cea-8ec7-c1ddd763d97b"
}
}


```

**2. Get Unit By Id**

- **Method**: `GET`
- **URL**: `/lms-service/v1/modules/{moduleId}`
- **Request Headers:**

```json
{
  "method": "GET",
  "url": "http://localhost:4002/lms-service/v1/modules/{moduleId}",
  "pathParams": {
    "moduleId": "bf7942f1-138b-475f-8c1c-416ae93fd811"
  },
  "queryParams": {},
  "headers": {
    "tenantid": "ef99949b-7f3a-4a5f-806a-e67e683e38f3",
    "organisationid": "d36d9079-0f42-4ba3-be03-26c9e79509ee",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {}
}
```

- **Response:**

```json
{
"id": "api.module.read",
"ver": "1.0",
"ts": "2025-06-17T08:18:36.585Z",
"params": {
"resmsgid": "msg-146859-1750148316585",
"status": "successful",
"err": null,
"errmsg": null
},
"responseCode": 200,
"result": {
"moduleId": "bf7942f1-138b-475f-8c1c-416ae93fd811",
"parentId": null,
"courseId": "380340b5-f419-4d9b-bac2-cb765ab89070",
"tenantId": "ef99949b-7f3a-4a5f-806a-e67e683e38f3",
"organisationId": "d36d9079-0f42-4ba3-be03-26c9e79509ee",
"title": "Week 2 - Build Updated",
"description": "Week 2 June 4th - June 10th Let's get started! This week is all about building critical professional skills to boost your career journey! There are 5 steps to complete in this Week.",
"image": null,
"startDatetime": null,
"endDatetime": null,
"eligibilityCriteria": null,
"badgeTerm": null,
"badgeId": null,
"ordering": 0,
"status": "unpublished",
"createdAt": "2025-06-17T08:17:14.507Z",
"createdBy": "100ba777-ca99-4cea-8ec7-c1ddd763d97b",
"updatedAt": "2025-06-17T08:18:28.683Z",
"updatedBy": "100ba777-ca99-4cea-8ec7-c1ddd763d97b"
}
}

```

**3. Search Units**

- **Method**: `GET`
- **URL**: `/lms-service/v1/modules/search`
- **Request Headers:**

```json
{
  "method": "GET",
  "url": "http://localhost:4002/lms-service/v1/modules/search",
  "pathParams": {},
  "queryParams": {
    "limit": 10,
    "query": "module",
    "courseId": "5903dca2-4cd1-4282-86cb-8dea57a07186",
    "status": "published",
    "offset": 0,
    "sortBy": "ordering",
    "orderBy": "ASC"
  },
  "headers": {
    "tenantid": "ef99949b-7f3a-4a5f-806a-e67e683e38f3",
    "organisationid": "d36d9079-0f42-4ba3-be03-26c9e79509ee",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {}
}
```

- **Response:**

```json
{
"id": "api.module.search",
"ver": "1.0",
"ts": "2025-08-22T07:16:54.030Z",
"params": {
"resmsgid": "msg-610170-1755847014030",
"status": "successful",
"err": null,
"errmsg": null
},
"responseCode": 200,
"result": {
"modules": [
{
"moduleId": "c3444f8b-4411-445d-8cea-85442f5490eb",
"parentId": null,
"courseId": "5903dca2-4cd1-4282-86cb-8dea57a07186",
"tenantId": "ef99949b-7f3a-4a5f-806a-e67e683e38f3",
"organisationId": "d36d9079-0f42-4ba3-be03-26c9e79509ee",
"title": "Week 2 - Build Module 2",
"description": "<section style='font-family: Manrope, Arial, sans-serif; max-width: 800px; margin: 20px auto; padding: 20px; background-color: #fafafa; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.05);'><ul style='list-style-type: square; padding-left: 20px; color: #434343; font-size: 14px; line-height: 1.5; margin: 0;'><li style='margin-bottom: 12px;'>Access your Discord Group to begin global peer-to-peer networking.</li><li style='margin-bottom: 12px;'>Take the strengths-based leadership skills assessment to understand yourself as a leader.</li><li style='margin-bottom: 12px;'>Complete personal reflection prompts and community discussion posts to enrich your learning experience.</li></ul></section>",
"image": "lms/modules/week1.png",
"startDatetime": "2025-08-01T00:00:00.000Z",
"endDatetime": "2025-08-31T23:59:59.999Z",
"prerequisites": null,
"badgeTerm": null,
"badgeId": null,
"ordering": 1,
"status": "published",
"createdAt": "2025-07-16T09:49:05.602Z",
"createdBy": "100ba777-ca99-4cea-8ec7-c1ddd763d97b",
"updatedAt": "2025-07-16T09:49:05.602Z",
"updatedBy": "100ba777-ca99-4cea-8ec7-c1ddd763d97b"
},
{
"moduleId": "b3bb4e89-6969-4e20-9707-47c8f81084d3",
"parentId": null,
"courseId": "5903dca2-4cd1-4282-86cb-8dea57a07186",
"tenantId": "ef99949b-7f3a-4a5f-806a-e67e683e38f3",
"organisationId": "d36d9079-0f42-4ba3-be03-26c9e79509ee",
"title": "Week 1 - Discover Module 2",
"description": "<section style='font-family: Manrope, Arial, sans-serif; max-width: 800px; margin: 20px auto; padding: 20px; background-color: #fafafa; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.05);'><ul style='list-style-type: square; padding-left: 20px; color: #434343; font-size: 14px; line-height: 1.5; margin: 0;'><li style='margin-bottom: 12px;'>Access your Discord Group to begin global peer-to-peer networking.</li><li style='margin-bottom: 12px;'>Take the strengths-based leadership skills assessment to understand yourself as a leader.</li><li style='margin-bottom: 12px;'>Complete personal reflection prompts and community discussion posts to enrich your learning experience.</li></ul></section>",
"image": "lms/modules/week1.png",
"startDatetime": "2025-08-01T00:00:00.000Z",
"endDatetime": "2025-08-31T23:59:59.999Z",
"prerequisites": null,
"badgeTerm": null,
"badgeId": null,
"ordering": 1,
"status": "published",
"createdAt": "2025-07-16T09:48:09.733Z",
"createdBy": "100ba777-ca99-4cea-8ec7-c1ddd763d97b",
"updatedAt": "2025-07-16T09:48:09.733Z",
"updatedBy": "100ba777-ca99-4cea-8ec7-c1ddd763d97b"
}
],
"totalElements": 2,
"offset": 0,
"limit": 10
}
}

## 3. Content (Lesson Management)

These APIs manage individual lessons/content items.


```

**1. Create Lesson**

- **Method**: `POST`
- **URL**: `/lms-service/v1/lessons`
- **Description**: Creates a new lesson.
- **Request Headers:**

```json
{
  "method": "POST",
  "url": "http://localhost:4002/lms-service/v1/lessons",
  "pathParams": {},
  "queryParams": {},
  "headers": {
    "tenantid": "ef99949b-7f3a-4a5f-806a-e67e683e38f3",
    "organisationid": "d36d9079-0f42-4ba3-be03-26c9e79509ee",
    "Content-Type": "application/json",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {
    "title": "ASSIGNMENT 2 - Complete Discussion Post #1",
    "format": "event",
    "description": "This discussion post encourages goal setting and will help you think about your personal mission by articulating your learning objectives and career aspirations. It also fosters peer interaction, allowing you to practice expressing your thoughts clearly.",
    "image": "/uploads/courses/1749555926678-622d3a2b-05ca-4ef7-809d-84e6e735f252.jpeg",
    "status": "published",
    "noOfAttempts": 0,
    "attemptsGrade": "highest",
    "resume": true,
    "allowResubmission": false,
    "idealTime": 30,
    "courseId": "18c13a95-b447-473f-a0d8-10a0ebcb263c",
    "moduleId": "bf7942f1-138b-475f-8c1c-416ae93fd811",
    "mediaContentSource": "MEDIA ID",
    "mediaContentSubFormat": "event"
  }
}
```

- **Response:**

```json
{
"id": "api.lesson.create",
"ver": "1.0",
"ts": "2025-06-17T09:15:35.408Z",
"params": {
"resmsgid": "msg-496929-1750151735408",
"status": "successful",
"err": null,
"errmsg": null
},
"responseCode": 201,
"result": {
"lessonId": "25085c47-21f3-4b59-b0c9-04adaa85f87c",
"tenantId": "ef99949b-7f3a-4a5f-806a-e67e683e38f3",
"organisationId": "d36d9079-0f42-4ba3-be03-26c9e79509ee",
"checkedOut": null,
"checkedOutTime": null,
"title": "ASSIGNMENT 2 - Complete Discussion Post #1",
"alias": "assignment-2-complete-discussion-post-1",
"status": "published",
"description": "This discussion post encourages goal setting and will help you think about your personal mission by articulating your learning objectives and career aspirations. It also fosters peer interaction, allowing you to practice expressing your thoughts clearly.",
"image": "/uploads/courses/1749555926678-622d3a2b-05ca-4ef7-809d-84e6e735f252.jpeg",
"startDatetime": null,
"endDatetime": null,
"storage": "local",
"noOfAttempts": 3,
"attemptsGrade": "highest",
"format": "video",
"mediaId": "be38bd49-a8f2-45e5-9988-0f6dc3d373e9",
"eligibilityCriteria": null,
"idealTime": 30,
"resume": false,
"totalMarks": null,
"passingMarks": null,
"params": {},
"courseId": "380340b5-f419-4d9b-bac2-cb765ab89070",
"moduleId": "bf7942f1-138b-475f-8c1c-416ae93fd811",
"sampleLesson": false,
"considerForPassing": true,
"createdAt": "2025-06-17T09:15:35.401Z",
"createdBy": "100ba777-ca99-4cea-8ec7-c1ddd763d97b",
"updatedAt": "2025-06-17T09:15:35.401Z",
"updatedBy": "100ba777-ca99-4cea-8ec7-c1ddd763d97b"
}
}


```

**2. Get Lesson By Id**

- **Method**: `GET`
- **URL**: `/lms-service/v1/lessons/{lessonId}`
- **Request Headers:**

```json
{
  "method": "GET",
  "url": "http://localhost:4002/lms-service/v1/lessons/{lessonId}",
  "pathParams": {
    "lessonId": "8f11ea37-4320-4c0b-ae4c-eaa18f5d3a7e"
  },
  "queryParams": {},
  "headers": {
    "tenantid": "ef99949b-7f3a-4a5f-806a-e67e683e38f3",
    "organisationId": "d36d9079-0f42-4ba3-be03-26c9e79509ee",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {}
}
```

- **Response:**

```json
{
"id": "api.lesson.read",
"ver": "1.0",
"ts": "2025-06-18T05:08:40.604Z",
"params": {
"resmsgid": "msg-815725-1750223320604",
"status": "successful",
"err": null,
"errmsg": null
},
"responseCode": 200,
"result": {
"lessonId": "8f11ea37-4320-4c0b-ae4c-eaa18f5d3a7e",
"tenantId": "ef99949b-7f3a-4a5f-806a-e67e683e38f3",
"organisationId": "d36d9079-0f42-4ba3-be03-26c9e79509ee",
"checkedOut": null,
"checkedOutTime": null,
"title": "ASSIGNMENT 2 - Complete Discussion Post #1",
"alias": "assignment-2-complete-discussion-post-1-757",
"status": "published",
"description": "This discussion post encourages goal setting and will help you think about your personal mission by articulating your learning objectives and career aspirations. It also fosters peer interaction, allowing you to practice expressing your thoughts clearly.",
"image": "/uploads/courses/1749555926678-622d3a2b-05ca-4ef7-809d-84e6e735f252.jpeg",
"startDatetime": null,
"endDatetime": null,
"storage": "local",
"noOfAttempts": 3,
"attemptsGrade": "highest",
"format": "video",
"mediaId": "ab153a11-164b-4636-bc1c-e1016f8b975a",
"eligibilityCriteria": null,
"idealTime": 30,
"resume": false,
"totalMarks": null,
"passingMarks": null,
"params": {},
"courseId": "18c13a95-b447-473f-a0d8-10a0ebcb263c",
"moduleId": "02959af2-843c-4462-a9e8-80e93873d067",
"sampleLesson": false,
"considerForPassing": true,
"createdAt": "2025-06-18T05:07:51.531Z",
"createdBy": "35113bfc-adce-47fc-b85d-871cbcb00bcc",
"updatedAt": "2025-06-18T05:08:23.967Z",
"updatedBy": "35113bfc-adce-47fc-b85d-871cbcb00bcc",
"media": {
"mediaId": "ab153a11-164b-4636-bc1c-e1016f8b975a",
"tenantId": "ef99949b-7f3a-4a5f-806a-e67e683e38f3",
"organisationId": "d36d9079-0f42-4ba3-be03-26c9e79509ee",
"format": "video",
"subFormat": "youtube.url",
"orgFilename": null,
"path": null,
"storage": "local",
"source": "https://youtu.be/iTs_mAG0Wfg",
"params": null,
"status": "published",
"createdAt": "2025-06-18T05:07:51.520Z",
"createdBy": "35113bfc-adce-47fc-b85d-871cbcb00bcc",
"updatedAt": "2025-06-18T05:08:23.962Z",
"updatedBy": "35113bfc-adce-47fc-b85d-871cbcb00bcc"
},
"associatedFiles": []
}
}


```

**3. Search Lessons**

- **Method**: `GET`
- **URL**: `/lms-service/v1/lessons`
- **Request Headers:**

```json
{
  "method": "GET",
  "url": "http://localhost:4002/lms-service/v1/lessons",
  "pathParams": {},
  "queryParams": {
    "query": "quiz",
    "status": "published",
    "format": "video",
    "subFormat": "youtube.url",
    "courseId": "6409e76a-48f1-42b3-abf2-c79b8170cf96",
    "moduleId": "8e95a005-280d-4795-b069-898f30de3614",
    "offset": 0,
    "limit": 20,
    "cohortId": "4d159509-fdc9-450a-b7cf-9ac41bacaf4a"
  },
  "headers": {
    "tenantId": "ef99949b-7f3a-4a5f-806a-e67e683e38f3",
    "organisationId": "d36d9079-0f42-4ba3-be03-26c9e79509ee",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {}
}
```

- **Response:**

```json
{
"id": "api.lesson.list",
"ver": "1.0",
"ts": "2025-08-11T11:08:27.478Z",
"params": {
"resmsgid": "msg-287016-1754910507478",
"status": "successful",
"err": null,
"errmsg": null
},
"responseCode": 200,
"result": {
"totalElements": 13,
"offset": 12,
"limit": 20,
"lessons": [
{
"lessonId": "15d2fd88-8bf3-43f8-844f-d3d16e2ca7ba",
"tenantId": "ef99949b-7f3a-4a5f-806a-e67e683e38f3",
"organisationId": "d36d9079-0f42-4ba3-be03-26c9e79509ee",
"checkedOut": null,
"checkedOutTime": null,
"title": "ASSIGNMENT 1 - Join Your Discord Group !",
"alias": "assignment-1-join-your-discord-group-878",
"status": "published",
"description": "<div style=\"max-width: 800px; margin: 40px auto; font-family: Arial, sans-serif; line-height: 1.6; font-size: 16px; color: #333;\">\n <p>\n One of the best things about the <strong>Aspire Leaders Program</strong> is the opportunity to connect with your global peers from day one.\n Our community platform is <strong>Discord</strong>. To facilitate your interactions, you will be assigned to work with a peer group of other students.\n </p>\n\n <p>\n Please watch the short video for instructions on joining your Discord server:\n <br />\n <a href=\"https://youtu.be/iTs_mAG0Wfg\" target=\"_blank\" style=\"color: #0056b3; text-decoration: underline;\">\n https://youtu.be/iTs_mAG0Wfg\n </a>\n </p>\n</div>",
"image": null,
"startDatetime": null,
"endDatetime": null,
"storage": "local",
"noOfAttempts": 0,
"allowResubmission": true,
"attemptsGrade": "last_attempt",
"format": "text_and_media",
"mediaId": "7aa4ebd3-b5f0-41bc-a35c-71c3b3ff1663",
"prerequisites": null,
"idealTime": 30,
"resume": true,
"totalMarks": 0,
"passingMarks": 0,
"params": {},
"courseId": "6409e76a-48f1-42b3-abf2-c79b8170cf96",
"moduleId": "8e95a005-280d-4795-b069-898f30de3614",
"sampleLesson": false,
"considerForPassing": true,
"ordering": 1,
"createdAt": "2025-08-05T00:46:53.061Z",
"createdBy": "35113bfc-adce-47fc-b85d-871cbcb00bcc",
"updatedAt": "2025-08-05T01:36:32.176Z",
"updatedBy": "35113bfc-adce-47fc-b85d-871cbcb00bcc",
"media": {
"mediaId": "7aa4ebd3-b5f0-41bc-a35c-71c3b3ff1663",
"tenantId": "ef99949b-7f3a-4a5f-806a-e67e683e38f3",
"organisationId": "d36d9079-0f42-4ba3-be03-26c9e79509ee",
"format": "text_and_media",
"subFormat": "discord.url",
"orgFilename": null,
"path": null,
"storage": "local",
"source": "https://discord.com/invite/44uKRMDA",
"params": null,
"status": "published",
"createdAt": "2025-08-04T19:16:53.048Z",
"createdBy": "35113bfc-adce-47fc-b85d-871cbcb00bcc",
"updatedAt": "2025-08-04T20:06:32.165Z",
"updatedBy": "35113bfc-adce-47fc-b85d-871cbcb00bcc"
}
}
]
}
}

## 4. Storage & Configuration


```

**1. Get Pre-signed URL**

- **Method**: `POST`
- **URL**: `/lms-service/v1/storage/presigned-url`
- **Description**: Generates a pre-signed URL for uploading files.
- **Request Headers:**

```json
{
  "method": "POST",
  "url": "http://localhost:4002/lms-service/v1/storage/presigned-url",
  "pathParams": {},
  "queryParams": {},
  "headers": {
    "tenantId": "ef99949b-7f3a-4a5f-806a-e67e683e38f3",
    "organisationId": "d36d9079-0f42-4ba3-be03-26c9e79509ee",
    "Content-Type": "application/json",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {
    "key": "path/to/file.jpg",
    "expiresIn": 3600,
    "contentType": "image/jpeg",
    "metadata": {},
    "sizeLimit": 5242880
  }
}
```

**2. Delete Storage Files**

- **Method**: `DELETE`
- **URL**: `/lms-service/v1/storage/files`
- **Request Headers:**

```json
{
  "method": "DELETE",
  "url": "http://localhost:4002/lms-service/v1/storage/files",
  "pathParams": {},
  "queryParams": {
    "key": "lms/lessons/vina-yak.png"
  },
  "headers": {
    "tenantId": "ef99949b-7f3a-4a5f-806a-e67e683e38f3",
    "organisationId": "d36d9079-0f42-4ba3-be03-26c9e79509ee",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {}
}
```

- **Response:**

```json
{
"id": "api.lms.service",
"ver": "1.0",
"ts": "2025-09-01T08:13:10.150Z",
"params": {
"resmsgid": "msg-593737-1756714390150",
"status": "successful",
"err": null,
"errmsg": null
},
"responseCode": 200,
"result": {
"success": true,
"message": "File lms/lessons/vina-yak.png deleted successfully",
"deletedKey": "lms/lessons/vina-yak.png",
"timestamp": "2025-09-01T08:13:10.150Z"
}
}

```

**3. Get Config**

- **Method**: `GET`
- **URL**: `/lms-service/v1/config`
- **Request Headers:**

```json
{
  "method": "GET",
  "url": "http://localhost:4002/lms-service/v1/config",
  "pathParams": {},
  "queryParams": {},
  "headers": {
    "tenantId": "ef99949b-7f3a-4a5f-806a-e67e683e38f3",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {}
}
```

- **Response:**

```json
{
"id": "api.config.read",
"ver": "1.0",
"ts": "2025-06-17T11:17:43.204Z",
"params": {
"resmsgid": "msg-547605-1750159063204",
"status": "successful",
"err": null,
"errmsg": null
},
"responseCode": 201,
"result": {
"configs": {
"date_format": "Y-m-d H:i:s",
"cloud_storage_provider": "aws",
"presigned_url_expires_in": 3600,
"image_mime_type": "image/jpeg, image/jpg, image/png",
"image_filesize": "50",
"video_mime_type": "video/mp4, video/webm",
"video_filesize": 500,
"document_mime_type": "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
"document_filesize": 500,
"courses_upload_path": "courses",
"modules_upload_path": "modules",
"lessons_upload_path": "lessons",
"shortdesc_char_limit": "200"
}
}
}

## 5. Reports & Tracking


```

**1. Course Completion Status**

**2. Get Hierarchy with Tracking**

- **Method**: `GET`
- **URL**: `/lms-service/v1/courses/{courseId}/hierarchy/tracking/{userId}`
- **Description**: Returns course structure with learner progress.
- **Request Headers:**

```json
{
  "method": "GET",
  "url": "http://localhost:4002/lms-service/v1/courses/{courseId}/hierarchy/tracking/{userId}",
  "pathParams": {},
  "queryParams": {},
  "headers": {
    "accept": "application/json",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {}
}
```

**1. Health Check (Root)**

- **Method**: `GET`
- **URL**: `/lms-service/v1`
- **Description**: Root endpoint for the LMS service.
- **Request Headers:**

```json
{
  "method": "GET",
  "url": "http://localhost:4002/lms-service/v1",
  "pathParams": {},
  "queryParams": {},
  "headers": {
    "accept": "application/json",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {}
}
```

- **Response:**

```json
{
  "id": "api.lms.service",
  "ver": "1.0",
  "ts": "2025-06-17T11:43:41.411Z",
  "params": {
    "resmsgid": "msg-000001-1750160621411",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "success": true
  }
}
```

---

## Storage

```

**1. Copy Storage Files**

- **Method**: `POST`
- **URL**: `/lms-service/v1/storage/files/copy`
- **Description**: Copies a file from one location to another in cloud storage.
- **Request Headers:**

```json
{
  "method": "POST",
  "url": "http://localhost:4002/lms-service/v1/storage/files/copy",
  "pathParams": {},
  "queryParams": {},
  "headers": {
    "accept": "application/json",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {
    "sourceKey": "lms/lessons/original-file.png",
    "destinationKey": "lms/lessons/copied-file.png"
  }
}
```

- **Response:**

```json
{
  "id": "api.lms.service",
  "ver": "1.0",
  "ts": "2025-06-17T11:43:41.411Z",
  "params": {
    "resmsgid": "msg-000002-1750160621411",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "success": true,
    "message": "File copied successfully",
    "destinationKey": "lms/lessons/copied-file.png"
  }
}
```

---

## Configuration

```

**1. Sync Configuration**

- **Method**: `POST`
- **URL**: `/lms-service/v1/config/sync`
- **Description**: Syncs configuration from an external service.
- **Request Headers:**

```json
{
  "method": "POST",
  "url": "http://localhost:4002/lms-service/v1/config/sync",
  "pathParams": {},
  "queryParams": {},
  "headers": {
    "accept": "*/*",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {}
}
```

- **Response:**

```json
{
  "id": "api.lms.service",
  "ver": "1.0",
  "ts": "2026-04-23T10:38:20.939Z",
  "params": {
    "resmsgid": "msg-334321-1776940700939",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 201,
  "result": {
    "config": {
      "date_format": "Y-m-d H:i:s",
      "cloud_storage_provider": "aws",
      "presigned_url_expires_in": 3600,
      "image_mime_type": "image/jpeg, image/jpg, image/png",
      "image_filesize": "5",
      "video_mime_type": "video/mp4, video/webm",
      "video_filesize": 50,
      "document_mime_type": "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "document_filesize": 50,
      "courses_upload_path": "lms/courses",
      "modules_upload_path": "lms/modules",
      "lessons_upload_path": "lms/lessons",
      "lessons_media_upload_path": "lms/lessons/media",
      "lessons_associated_media_upload_path": "lms/lessons/media",
      "shortdesc_char_limit": "200"
    },
    "lastSynced": "2026-04-23T10:38:20.938Z",
    "IsConfigsSync": 1
  }
}
```

---

## Courses

**1. Get Next Course, Module or Lesson ID**

- **Method**: `GET`
- **URL**: `/lms-service/v1/courses/next-id`
- **Description**: Returns the next available ID for a course, module, or lesson.
- **Request Headers:**

```json
{
  "method": "GET",
  "url": "http://localhost:4002/lms-service/v1/courses/next-id",
  "pathParams": {},
  "queryParams": {
    "nextIdFor": "course",
    "id": "00a5ff06-4e19-4858-b94e-4b32194fe668"
  },
  "headers": {
    "accept": "application/json",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {}
}
```

- **Response:**

```json
{
  "id": "api.course.next",
  "ver": "1.0",
  "ts": "2026-04-23T10:43:53.264Z",
  "params": {
    "resmsgid": "msg-123401-1776941033264",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "success": true,
    "data": {
      "nextId": "",
      "nextIdFor": "course",
      "nextTitle": null,
      "isLast": false
    }
  }
}
```

**2. Get Lesson Counts for Courses**

- **Method**: `GET`
- **URL**: `/lms-service/v1/courses/lesson-counts`
- **Description**: Returns the total lesson count for one or more courses.
- **Request Headers:**

```json
{
  "method": "GET",
  "url": "http://localhost:4002/lms-service/v1/courses/lesson-counts",
  "pathParams": {},
  "queryParams": {
    "courseIds": "00a5ff06-4e19-4858-b94e-4b32194fe668"
  },
  "headers": {
    "accept": "application/json",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {}
}
```

- **Query Params:**

```json
{
  "courseIds": "380340b5-f419-4d9b-bac2-cb765ab89070,18c13a95-b447-473f-a0d8-10a0ebcb263c"
}
```

- **Response:**

```json
{
  "id": "api.course.lessonCounts",
  "ver": "1.0",
  "ts": "2025-06-17T11:43:41.411Z",
  "params": {
    "resmsgid": "msg-000005-1750160621411",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "counts": [
      {
        "courseId": "380340b5-f419-4d9b-bac2-cb765ab89070",
        "lessonCount": 12,
        "videoCount": 5,
        "resourceCount": 2,
        "totalItems": 7
      },
      {
        "courseId": "18c13a95-b447-473f-a0d8-10a0ebcb263c",
        "lessonCount": 8,
        "videoCount": 1,
        "resourceCount": 0,
        "totalItems": 1
      }
    ]
  }
}
```

**3. Get Course Hierarchy**

- **Method**: `GET`
- **URL**: `/lms-service/v1/courses/{courseId}/hierarchy`
- **Description**: Returns the full course structure including modules and lessons.
- **Request Headers:**

```json
{
  "method": "GET",
  "url": "http://localhost:4002/lms-service/v1/courses/{courseId}/hierarchy",
  "pathParams": {
    "courseId": "00a5ff06-4e19-4858-b94e-4b32194fe668"
  },
  "queryParams": {},
  "headers": {
    "accept": "application/json",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {}
}
```

- **Path Params:**

```json
{
  "courseId": "380340b5-f419-4d9b-bac2-cb765ab89070"
}
```

- **Response:**

```json
{
  "id": "api.course.hierarchy",
  "ver": "1.0",
  "ts": "2026-04-23T11:00:49.934Z",
  "params": {
    "resmsgid": "msg-783154-1776942049937",
    "status": "successful"
  },
  "responseCode": 200,
  "result": {
    "courseId": "00a5ff06-4e19-4858-b94e-4b32194fe668",
    "title": "Career Development",
    "alias": "career-development",
    "shortDescription": "Module 1",
    "status": "published",
    "ordering": 3,

    "modules": [
      {
        "moduleId": "b5c2c1dd-b36c-4688-aa5e-bc42fc5656b7",
        "title": "Week 1: Discover",
        "ordering": 1,
        "status": "published",

        "lessons": [
          {
            "lessonId": "8ee0c332-af9e-46a9-a7a9-0832e896376e",
            "title": "sss",
            "alias": "sss-copy",
            "status": "published",
            "format": "test",
            "totalMarks": 100,
            "passingMarks": 60
          },
          {
            "lessonId": "62e78e92-6f5b-4b25-8a7c-ace236b1c320",
            "title": "w",
            "alias": "w-908-copy",
            "status": "published",
            "format": "test"
          }
        ]
      }
    ]
  }
}
```

**4. Update Courses Order in Bulk**

- **Method**: `PUT`
- **URL**: `/lms-service/v1/courses/order/structure`
- **Description**: Updates the ordering of multiple courses in bulk.
- **Request Headers:**

```json
{
  "method": "PUT",
  "url": "http://localhost:4002/lms-service/v1/courses/order/structure",
  "pathParams": {},
  "queryParams": {
    "userId": "00045b65-71ef-434b-921d-9897fe6aa4e1"
  },
  "headers": {
    "accept": "application/json",
    "Content-Type": "application/json",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {
    "courses": [
      {
        "courseId": "123e4567-e89b-12d3-a456-426614174000",
        "order": 1
      },
      {
        "courseId": "123e4567-e89b-12d3-a456-426614174001",
        "order": 2
      },
      {
        "courseId": "123e4567-e89b-12d3-a456-426614174002",
        "order": 3
      }
    ]
  }
}
```

- **Response:**

```json
{
  "id": "api.course.order",
  "ver": "1.0",
  "ts": "2025-06-17T11:43:41.411Z",
  "params": {
    "resmsgid": "msg-000007-1750160621411",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "success": true,
    "message": "Course order updated successfully"
  }
}
```

**5. Update Course Structure**

- **Method**: `PUT`
- **URL**: `/lms-service/v1/courses/{courseId}/structure`
- **Description**: Updates the internal structure of a specific course.
- **Request Headers:**

```json
{
  "method": "PUT",
  "url": "http://localhost:4002/lms-service/v1/courses/{courseId}/structure",
  "pathParams": {
    "courseId": "b5c2c1dd-b36c-4688-aa5e-bc42fc5656b7"
  },
  "queryParams": {
    "userId": "00045b65-71ef-434b-921d-9897fe6aa4e1"
  },
  "headers": {
    "accept": "application/json",
    "Content-Type": "application/json",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {
    "modules": [
      {
        "moduleId": "123e4567-e89b-12d3-a456-426614174001",
        "order": 1,
        "lessons": [
          {
            "lessonId": "456e7890-e89b-12d3-a456-426614174001",
            "order": 1
          },
          {
            "lessonId": "456e7890-e89b-12d3-a456-426614174002",
            "order": 2
          }
        ]
      },
      {
        "moduleId": "123e4567-e89b-12d3-a456-426614174002",
        "order": 2,
        "lessons": [
          {
            "lessonId": "456e7890-e89b-12d3-a456-426614174003",
            "order": 1
          }
        ]
      }
    ]
  }
}
```

- **Response:**

```json
{
  "id": "api.course.structure",
  "ver": "1.0",
  "ts": "2025-06-17T11:43:41.411Z",
  "params": {
    "resmsgid": "msg-000008-1750160621411",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "success": true,
    "message": "Course structure updated successfully"
  }
}
```

---

## Modules

**1. Delete Module**

- **Method**: `DELETE`
- **URL**: `/lms-service/v1/modules/{moduleId}`
- **Description**: Soft deletes/archives a module.
- **Request Headers:**

```json
{
  "method": "GET",
  "url": "http://localhost:4002/lms-service/v1/modules/{moduleId}",
  "pathParams": {
    "moduleId": "022797d1-b370-48f5-974a-14f4c7da2607"
  },
  "queryParams": {},
  "headers": {
    "accept": "application/json",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {}
}
```

- **Response:**

```json
{
  "id": "api.module.delete",
  "ver": "1.0",
  "ts": "2025-06-17T11:43:41.411Z",
  "params": {
    "resmsgid": "msg-000009-1750160621411",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "success": true,
    "message": "Module deleted successfully"
  }
}
```

**2. Clone Module**

- **Method**: `POST`
- **URL**: `/lms-service/v1/modules/{moduleId}/clone`
- **Description**: Clones a module along with all its lessons and submodules.
- **Request Headers:**

```json
{
  "method": "POST",
  "url": "http://localhost:4002/lms-service/v1/modules/{moduleId}/clone",
  "pathParams": {
    "moduleId": "022797d1-b370-48f5-974a-14f4c7da2607"
  },
  "queryParams": {
    "userId": "022797d1-b370-48f5-974a-14f4c7da2607"
  },
  "headers": {
    "accept": "application/json",
    "Content-Type": "application/json",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {
    "newCourseId": "123e4567-e89b-12d3-a456-426614174000"
  }
}
```

- **Response:**

```json
{
  "id": "api.module.clone",
  "ver": "1.0",
  "ts": "2025-08-11T06:23:54.728Z",
  "params": {
    "resmsgid": "msg-553170-1754893434728",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 201,
  "result": {
    "moduleId": "99e371f5-69b5-4b1f-a025-a8d8e86f048a",
    "parentId": null,
    "courseId": "98b835f1-b1d8-44b8-a4ce-c8bae1fa3adb",
    "tenantId": "ef99949b-7f3a-4a5f-806a-e67e683e38f3",
    "organisationId": "d36d9079-0f42-4ba3-be03-26c9e79509ee",
    "title": "Week 1 - Discover (Copy)",
    "ordering": 1,
    "status": "published",
    "createdAt": "2025-07-11T11:42:53.577Z",
    "createdBy": "35113bfc-adce-47fc-b85d-871cbcb00bcc",
    "updatedAt": "2025-07-15T08:46:39.345Z",
    "updatedBy": "35113bfc-adce-47fc-b85d-871cbcb00bcc"
  }
}
```

---

## Lessons

**1. Update Lesson**

- **Method**: `PATCH`
- **URL**: `/lms-service/v1/lessons/{lessonId}`
- **Description**: Updates lesson metadata or content.
- **Request Headers:**

```json
{
  "method": "PATCH",
  "url": "https://middleware-dev.aspireleaders.org/lms-service/v1/lessons/{lessonId}",
  "pathParams": {
    "lessonId": "25085c47-21f3-4b59-b0c9-04adaa85f87c"
  },
  "queryParams": {},
  "headers": {
    "tenantId": "ef99949b-7f3a-4a5f-806a-e67e683e38f3",
    "organisationId": "d36d9079-0f42-4ba3-be03-26c9e79509ee",
    "Content-Type": "application/json",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {
    "title": "ASSIGNMENT 2 - Complete Discussion Post #1",
    "format": "video",
    "description": "This discussion post encourages goal setting and will help you think about your personal mission by articulating your learning objectives and career aspirations.",
    "image": "/uploads/courses/1749555926678-622d3a2b-05ca-4ef7-809d-84e6e735f252.jpeg",
    "status": "published",
    "noOfAttempts": 3,
    "attemptsGrade": "highest",
    "idealTime": 30,
    "courseId": "18c13a95-b447-473f-a0d8-10a0ebcb263c",
    "moduleId": "bf7942f1-138b-475f-8c1c-416ae93fd811",
    "mediaContentSource": "https://youtu.be/iTs_mAG0Wfg",
    "mediaContentSubFormat": "youtube.url"
  }
}
```

- **Response:**

```json
{
  "id": "api.lesson.update",
  "ver": "1.0",
  "ts": "2025-06-18T05:08:23.979Z",
  "params": {
    "resmsgid": "msg-173606-1750223303980",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "lessonId": "8f11ea37-4320-4c0b-ae4c-eaa18f5d3a7e",
    "tenantId": "ef99949b-7f3a-4a5f-806a-e67e683e38f3",
    "organisationId": "d36d9079-0f42-4ba3-be03-26c9e79509ee",
    "checkedOut": null,
    "checkedOutTime": null,
    "title": "ASSIGNMENT 2 - Complete Discussion Post #1",
    "alias": "assignment-2-complete-discussion-post-1-757",
    "status": "published",
    "description": "This discussion post encourages goal setting and will help you think about your personal mission by articulating your learning objectives and career aspirations. It also fosters peer interaction, allowing you to practice expressing your thoughts clearly.",
    "image": "/uploads/courses/1749555926678-622d3a2b-05ca-4ef7-809d-84e6e735f252.jpeg",
    "startDatetime": null,
    "endDatetime": null,
    "storage": "local",
    "noOfAttempts": 3,
    "attemptsGrade": "highest",
    "format": "video",
    "mediaId": "ab153a11-164b-4636-bc1c-e1016f8b975a",
    "eligibilityCriteria": null,
    "idealTime": 30,
    "resume": false,
    "totalMarks": null,
    "passingMarks": null,
    "params": {},
    "courseId": "18c13a95-b447-473f-a0d8-10a0ebcb263c",
    "moduleId": "02959af2-843c-4462-a9e8-80e93873d067",
    "sampleLesson": false,
    "considerForPassing": true,
    "createdAt": "2025-06-18T05:07:51.531Z",
    "createdBy": "35113bfc-adce-47fc-b85d-871cbcb00bcc",
    "updatedAt": "2025-06-18T05:08:23.967Z",
    "updatedBy": "35113bfc-adce-47fc-b85d-871cbcb00bcc"
  }
}
```

**2. Delete Lesson**

- **Method**: `DELETE`
- **URL**: `/lms-service/v1/lessons/{lessonId}`
- **Description**: Deletes a lesson permanently.
- **Request Headers:**

```json
{
  "method": "DELETE",
  "url": "https://middleware-dev.aspireleaders.org/lms-service/v1/lessons/{lessonId}",
  "pathParams": {
    "lessonId": "25085c47-21f3-4b59-b0c9-04adaa85f87c"
  },
  "queryParams": {},
  "headers": {
    "tenantid": "ef99949b-7f3a-4a5f-806a-e67e683e38f3",
    "organisationid": "d36d9079-0f42-4ba3-be03-26c9e79509ee",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {}
}
```

- **Response:**

```json
{
  "id": "api.lesson.delete",
  "ver": "1.0",
  "ts": "2025-06-17T09:15:35.408Z",
  "params": {
    "resmsgid": "msg-000011-1750151735408",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "success": true,
    "message": "Lesson deleted successfully"
  }
}
```

**3. Get Lessons by Module ID**

- **Method**: `GET`
- **URL**: `/lms-service/v1/lessons/module/{moduleId}`
- **Description**: Retrieves all lessons belonging to a specific module.
- **Request Headers:**

```json
{
  "method": "GET",
  "url": "http://localhost:4002/lms-service/v1/lessons/module/{moduleId}",
  "pathParams": {
    "moduleId": "00a5ff06-4e19-4858-b94e-4b32194fe668"
  },
  "queryParams": {},
  "headers": {
    "accept": "*/*",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {}
}
```

- **Response:**

```json
{
  "id": "api.lesson.listByModule",
  "ver": "1.0",
  "ts": "2025-06-17T09:15:35.408Z",
  "params": {
    "resmsgid": "msg-000012-1750151735408",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "lessons": [
      {
        "lessonId": "25085c47-21f3-4b59-b0c9-04adaa85f87c",
        "title": "ASSIGNMENT 2 - Complete Discussion Post #1",
        "status": "published",
        "ordering": 1,
        "moduleId": "bf7942f1-138b-475f-8c1c-416ae93fd811"
      }
    ],
    "totalElements": 1
  }
}
```

**4. Get Lesson by Test ID**

- **Method**: `GET`
- **URL**: `/lms-service/v1/lessons/test/{testId}`
- **Description**: Retrieves lesson details using an associated test ID.
- **Request Headers:**

```json
{
  "method": "GET",
  "url": "http://localhost:4002/lms-service/v1/lessons/test/{testId}",
  "pathParams": {
    "testId": "0038e2a3-803c-47ad-b3cd-d6da4b0cf393"
  },
  "queryParams": {
    "testId": "0038e2a3-803c-47ad-b3cd-d6da4b0cf393"
  },
  "headers": {
    "accept": "*/*",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {}
}
```

- **Response:**

```json
{
  "id": "api.lesson.readByTest",
  "ver": "1.0",
  "ts": "2025-06-17T09:15:35.408Z",
  "params": {
    "resmsgid": "msg-000013-1750151735408",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "lessonId": "25085c47-21f3-4b59-b0c9-04adaa85f87c",
    "title": "ASSIGNMENT 2 - Complete Discussion Post #1",
    "format": "event",
    "status": "published",
    "testId": "0038e2a3-803c-47ad-b3cd-d6da4b0cf393"
  }
}
```

**5. Clone Lesson**

- **Method**: `POST`
- **URL**: `/lms-service/v1/lessons/{lessonId}/clone`
- **Description**: Clones a lesson along with all its media and associated files.
- **Request Headers:**

```json
{
  "method": "POST",
  "url": "http://localhost:4002/lms-service/v1/lessons/{lessonId}/clone",
  "pathParams": {
    "lessonId": "0017dcd4-132d-4b95-8c9f-7fc5a6f7ec47"
  },
  "queryParams": {
    "userId": "0017dcd4-132d-4b95-8c9f-7fc5a6f7ec47"
  },
  "headers": {
    "accept": "application/json",
    "Content-Type": "application/json",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {
    "newCourseId": "123e4567-e89b-12d3-a456-426614174000",
    "newModuleId": "123e4567-e89b-12d3-a456-426614174000"
  }
}
```

- **Response:**

```json
{
  "id": "api.lesson.clone",
  "ver": "1.0",
  "ts": "2025-06-17T09:15:35.408Z",
  "params": {
    "resmsgid": "msg-000014-1750151735408",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 201,
  "result": {
    "lessonId": "new-lesson-uuid",
    "title": "ASSIGNMENT 2 - Complete Discussion Post #1 (Copy)",
    "status": "unpublished",
    "moduleId": "bf7942f1-138b-475f-8c1c-416ae93fd811",
    "courseId": "98b835f1-b1d8-44b8-a4ce-c8bae1fa3adb",
    "createdAt": "2025-06-17T09:15:35.401Z",
    "createdBy": "100ba777-ca99-4cea-8ec7-c1ddd763d97b"
  }
}
```

---

## Media

**1. Upload Media**

- **Method**: `POST`
- **URL**: `/lms-service/v1/media/upload`
- **Description**: Uploads a media file to the LMS.
- **Request Headers:**

```json
{
  "method": "POST",
  "url": "http://localhost:4002/lms-service/v1/media/upload",
  "pathParams": {},
  "queryParams": {
    "userId": "0017dcd4-132d-4b95-8c9f-7fc5a6f7ec47"
  },
  "headers": {
    "accept": "*/*",
    "Content-Type": "multipart/form-data",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {
    "format": "video",
    "subFormat": "video.youtube",
    "path": "/uploads/media/example.pdf",
    "source": "https://youtube.com/watch?v=example",
    "storage": "local",
    "params": {
      "duration": 120,
      "resolution": "720p"
    },
    "createdBy": "user-123"
  }
}
```

- **Response:**

```json
{
  "id": "api.media.upload",
  "ver": "1.0",
  "ts": "2026-04-23T11:31:17.175Z",
  "params": {
    "resmsgid": "msg-44595-1776943877175",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 201,
  "result": {
    "mediaId": "a5a5d2cd-7bce-49d4-a441-25f62b9faae3",
    "format": "video",
    "subFormat": "video.youtube",
    "path": "/uploads/media/example.pdf",
    "storage": "local",
    "source": "/uploads/media/example.pdf",
    "params": "{\"duration\":120,\"resolution\":\"720p\"}",
    "status": "published",
    "createdAt": "2026-04-23T06:01:16.356Z",
    "createdBy": "0017dcd4-132d-4b95-8c9f-7fc5a6f7ec47",
    "updatedAt": "2026-04-23T06:01:16.356Z",
    "updatedBy": "0017dcd4-132d-4b95-8c9f-7fc5a6f7ec47"
  }
}
```

**2. Get Media List**

- **Method**: `GET`
- **URL**: `/lms-service/v1/media`
- **Description**: Retrieves a list of all media files.
- **Request Headers:**

```json
{
  "method": "GET",
  "url": "http://localhost:4002/lms-service/v1/media",
  "pathParams": {},
  "queryParams": {
    "format": "video"
  },
  "headers": {
    "accept": "*/*",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {}
}
```

- **Response:**

```json
{
  "id": "api.media.list",
  "ver": "1.0",
  "ts": "2026-04-23T11:32:21.998Z",
  "params": {
    "resmsgid": "msg-758383-1776943942001",
    "status": "successful"
  },
  "responseCode": 200,
  "result": [
    [
      {
        "mediaId": "a5a5d2cd-7bce-49d4-a441-25f62b9faae3",
        "format": "video",
        "subFormat": "video.youtube",
        "path": "/uploads/media/example.pdf",
        "storage": "local",
        "status": "published",
        "createdAt": "2026-04-23T06:01:16.356Z"
      },
      {
        "mediaId": "ae939d22-48de-4a9e-83cb-7b2cd593480f",
        "format": "video",
        "subFormat": "youtube.url",
        "source": "https://www.youtube.com/watch?v=1_53LhQgeQI",
        "storage": "local",
        "status": "published",
        "createdAt": "2026-04-09T03:37:38.216Z"
      },
      {
        "mediaId": "04875153-e96d-40a9-9beb-8e65e19c7155",
        "format": "video",
        "subFormat": "youtube.url",
        "source": "https://youtu.be/KoOsLY9Q56E",
        "storage": "local",
        "status": "published",
        "createdAt": "2026-04-09T03:32:44.499Z"
      }
    ],
    505
  ]
}
```

**3. Get Media by ID**

- **Method**: `GET`
- **URL**: `/lms-service/v1/media/{mediaId}`
- **Description**: Retrieves details of a specific media file.
- **Request Headers:**

```json
{
  "method": "GET",
  "url": "http://localhost:4002/lms-service/v1/media/{mediaId}",
  "pathParams": {
    "mediaId": "a5a5d2cd-7bce-49d4-a441-25f62b9faae3"
  },
  "queryParams": {},
  "headers": {
    "accept": "*/*",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {}
}
```

- **Response:**

```json
{
  "id": "api.media.read",
  "ver": "1.0",
  "ts": "2025-06-18T05:08:40.604Z",
  "params": {
    "resmsgid": "msg-000017-1750223320604",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "mediaId": "ab153a11-164b-4636-bc1c-e1016f8b975a",
    "tenantId": "ef99949b-7f3a-4a5f-806a-e67e683e38f3",
    "organisationId": "d36d9079-0f42-4ba3-be03-26c9e79509ee",
    "format": "video",
    "subFormat": "youtube.url",
    "orgFilename": null,
    "path": null,
    "storage": "local",
    "source": "https://youtu.be/iTs_mAG0Wfg",
    "params": null,
    "status": "published",
    "createdAt": "2025-06-18T05:07:51.520Z",
    "createdBy": "35113bfc-adce-47fc-b85d-871cbcb00bcc",
    "updatedAt": "2025-06-18T05:08:23.962Z",
    "updatedBy": "35113bfc-adce-47fc-b85d-871cbcb00bcc"
  }
}
```

**4. Delete Media**

- **Method**: `DELETE`
- **URL**: `/lms-service/v1/media/{mediaId}`
- **Description**: Deletes a media file from the system.
- **Request Headers:**

```json
{
  "method": "DELETE",
  "url": "http://localhost:4002/lms-service/v1/media/{mediaId}",
  "pathParams": {
    "mediaId": "a5a5d2cd-7bce-49d4-a441-25f62b9faae3"
  },
  "queryParams": {
    "userId": "a5a5d2cd-7bce-49d4-a441-25f62b9faae3"
  },
  "headers": {
    "accept": "*/*",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {}
}
```

- **Response:**

```json
{
  "id": "api.media.delete",
  "ver": "1.0",
  "ts": "2025-06-17T09:15:35.408Z",
  "params": {
    "resmsgid": "msg-000018-1750151735408",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "success": true,
    "message": "Media deleted successfully"
  }
}
```

**5. Associate Media with Lesson**

- **Method**: `POST`
- **URL**: `/lms-service/v1/media/{mediaId}/associate/{lessonId}`
- **Description**: Associates a media file with a specific lesson.
- **Request Headers:**

```json
{
  "method": "POST",
  "url": "http://localhost:4002/lms-service/v1/media/{mediaId}/associate/{lessonId}",
  "pathParams": {
    "mediaId": "a5a5d2cd-7bce-49d4-a441-25f62b9faae3",
    "lessonId": "a5a5d2cd-7bce-49d4-a441-25f62b9faae3"
  },
  "queryParams": {
    "userId": "a5a5d2cd-7bce-49d4-a441-25f62b9faae3"
  },
  "headers": {
    "accept": "*/*",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {}
}
```

- **Response:**

```json
{
  "id": "api.media.associate",
  "ver": "1.0",
  "ts": "2025-06-17T09:15:35.408Z",
  "params": {
    "resmsgid": "msg-000019-1750151735408",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 201,
  "result": {
    "success": true,
    "message": "Media associated with lesson successfully"
  }
}
```

**6. Remove Media Association from Lesson**

- **Method**: `DELETE`
- **URL**: `/lms-service/v1/media/{mediaId}/associate/{lessonId}`
- **Description**: Removes the association between a media file and a lesson.
- **Request Headers:**

```json
{
  "method": "DELETE",
  "url": "http://localhost:4002/lms-service/v1/media/{mediaId}/associate/{lessonId}",
  "pathParams": {
    "mediaId": "a5a5d2cd-7bce-49d4-a441-25f62b9faae3",
    "lessonId": "a5a5d2cd-7bce-49d4-a441-25f62b9faae3"
  },
  "queryParams": {
    "userId": "a5a5d2cd-7bce-49d4-a441-25f62b9f-aae3"
  },
  "headers": {
    "accept": "*/*",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {}
}
```

- **Response:**

```json
{
  "id": "api.media.disassociate",
  "ver": "1.0",
  "ts": "2025-06-17T09:15:35.408Z",
  "params": {
    "resmsgid": "msg-000020-1750151735408",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "success": true,
    "message": "Media association removed successfully"
  }
}
```

---

## Enrollments

**1. Enroll User for a Course**

- **Method**: `POST`
- **URL**: `/lms-service/v1/enrollments`
- **Description**: Enrolls a user into a course.
- **Request Headers:**

```json
{
  "method": "POST",
  "url": "http://localhost:4002/lms-service/v1/enrollments",
  "pathParams": {},
  "queryParams": {
    "userId": "a5a5d2cd-7bce-49d4-a441-25f62b9faae3"
  },
  "headers": {
    "accept": "application/json",
    "Content-Type": "application/json",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {
    "learnerId": "123e4567-e89b-12d3-a456-426614174000",
    "courseId": "123e4567-e89b-12d3-a456-426614174000",
    "status": "PUBLISHED",
    "endTime": "2024-12-31T23:59:59Z",
    "unlimitedPlan": false,
    "beforeExpiryMail": false,
    "afterExpiryMail": false,
    "params": {
      "priority": "high",
      "notes": "VIP student"
    },
    "enrolledBy": "123e4567-e89b-12d3-a456-426614174000"
  }
}
```

- **Response:**

```json
{
  "id": "api.enrollment.create",
  "ver": "1.0",
  "ts": "2025-06-17T09:15:35.408Z",
  "params": {
    "resmsgid": "msg-000021-1750151735408",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 201,
  "result": {
    "enrollmentId": "enroll-uuid-here",
    "userId": "100ba777-ca99-4cea-8ec7-c1ddd763d97b",
    "courseId": "380340b5-f419-4d9b-bac2-cb765ab89070",
    "status": "active",
    "createdAt": "2025-06-17T09:15:35.401Z"
  }
}
```

**2. Get User Enrollments by Course ID**

- **Method**: `GET`
- **URL**: `/lms-service/v1/enrollments`
- **Description**: Returns all enrollments for a given course.
- **Request Headers:**

```json
{
  "method": "GET",
  "url": "http://localhost:4002/lms-service/v1/enrollments",
  "pathParams": {},
  "queryParams": {
    "learnerId": "a5a5d2cd-7bce-49d4-a441-25f62b9faae3",
    "courseId": "a5a5d2cd-7bce-49d4-a441-25f62b9faae3",
    "status": "published",
    "limit": 10,
    "page": 2
  },
  "headers": {
    "accept": "application/json",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {}
}
```

- **Response:**

```json
{
  "id": "api.enrollment.list",
  "ver": "1.0",
  "ts": "2025-06-17T09:15:35.408Z",
  "params": {
    "resmsgid": "msg-000022-1750151735408",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "enrollments": [
      {
        "enrollmentId": "enroll-uuid-here",
        "userId": "100ba777-ca99-4cea-8ec7-c1ddd763d97b",
        "courseId": "380340b5-f419-4d9b-bac2-cb765ab89070",
        "status": "active",
        "createdAt": "2025-06-17T09:15:35.401Z"
      }
    ],
    "totalElements": 1
  }
}
```

**3. Hard Delete Enrollment**

- **Method**: `DELETE`
- **URL**: `/lms-service/v1/enrollments`
- **Description**: Permanently deletes an enrollment and all related tracking records.
- **Request Headers:**

```json
{
  "method": "DELETE",
  "url": "http://localhost:4002/lms-service/v1/enrollments",
  "pathParams": {},
  "queryParams": {},
  "headers": {
    "accept": "application/json",
    "Content-Type": "application/json",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {
    "courseId": "123e4567-e89b-12d3-a456-426614174000",
    "userId": "123e4567-e89b-12d3-a456-426614174000"
  }
}
```

- **Response:**

```json
{
  "id": "api.enrollment.delete",
  "ver": "1.0",
  "ts": "2025-06-17T09:15:35.408Z",
  "params": {
    "resmsgid": "msg-000023-1750151735408",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "success": true,
    "message": "Enrollment and all related tracking records deleted successfully"
  }
}
```

**4. Get Enrolled Courses by User ID**

- **Method**: `GET`
- **URL**: `/lms-service/v1/enrollments/users-courses`
- **Description**: Returns all courses a specific user is enrolled in.
- **Request Headers:**

```json
{
  "method": "GET",
  "url": "http://localhost:4002/lms-service/v1/enrollments/users-courses",
  "pathParams": {},
  "queryParams": {
    "userId": "00045b65-71ef-434b-921d-9897fe6aa4e1",
    "limit": 10,
    "offset": 0
  },
  "headers": {
    "accept": "application/json",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {}
}
```

- **Response:**

```json
{
  "id": "api.enrollment.userCourses",
  "ver": "1.0",
  "ts": "2025-06-17T09:15:35.408Z",
  "params": {
    "resmsgid": "msg-000024-1750151735408",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "courses": [
      {
        "courseId": "380340b5-f419-4d9b-bac2-cb765ab89070",
        "title": "Module 1 - Personal & Professional Development",
        "status": "published",
        "enrollmentId": "enroll-uuid-here",
        "enrolledAt": "2025-06-17T09:15:35.401Z"
      }
    ],
    "totalElements": 1
  }
}
```

**5. Get Enrollment by ID**

- **Method**: `GET`
- **URL**: `/lms-service/v1/enrollments/{enrollmentId}`
- **Description**: Retrieves details of a specific enrollment.
- **Request Headers:**

```json
{
  "method": "GET",
  "url": "http://localhost:4002/lms-service/v1/enrollments/{enrollmentId}",
  "pathParams": {
    "enrollmentId": "123e4567-e89b-12d3-a456-426614174000"
  },
  "queryParams": {},
  "headers": {
    "accept": "application/json",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {}
}
```

- **Response:**

```json
{
  "id": "api.enrollment.read",
  "ver": "1.0",
  "ts": "2025-06-17T09:15:35.408Z",
  "params": {
    "resmsgid": "msg-000025-1750151735408",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "enrollmentId": "enroll-uuid-here",
    "userId": "100ba777-ca99-4cea-8ec7-c1ddd763d97b",
    "courseId": "380340b5-f419-4d9b-bac2-cb765ab89070",
    "status": "active",
    "createdAt": "2025-06-17T09:15:35.401Z",
    "updatedAt": "2025-06-17T09:15:35.401Z"
  }
}
```

**6. Update Enrollment**

- **Method**: `PUT`
- **URL**: `/lms-service/v1/enrollments/{enrollmentId}`
- **Description**: Updates an existing enrollment record.
- **Request Headers:**

```json
{
  "method": "PUT",
  "url": "http://localhost:4002/lms-service/v1/enrollments/{enrollmentId}",
  "pathParams": {
    "enrollmentId": "123e4567-e89b-12d3-a456-426614174000"
  },
  "queryParams": {},
  "headers": {
    "accept": "application/json",
    "Content-Type": "application/json",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {
    "status": "published",
    "endTime": "2024-12-31T23:59:59Z",
    "unlimitedPlan": false,
    "beforeExpiryMail": false,
    "afterExpiryMail": false,
    "params": {
      "priority": "high",
      "notes": "VIP student"
    }
  }
}
```

- **Response:**

```json
{
  "id": "api.enrollment.update",
  "ver": "1.0",
  "ts": "2025-06-17T09:15:35.408Z",
  "params": {
    "resmsgid": "msg-000026-1750151735408",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "enrollmentId": "enroll-uuid-here",
    "status": "completed",
    "updatedAt": "2025-06-17T09:20:00.000Z",
    "updatedBy": "100ba777-ca99-4cea-8ec7-c1ddd763d97b"
  }
}
```

---

## Health

**1. Health Check (Readiness)**

- **Method**: `GET`
- **URL**: `/health`
- **Description**: Checks service health and database connection. Used as a readiness probe.
- **Request Headers:**

```json
{
  "method": "GET",
  "url": "http://localhost:4002/health",
  "pathParams": {},
  "queryParams": {},
  "headers": {
    "accept": "*/*"
  },
  "body": {}
}
```

- **Response:**

```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2025-06-17T09:15:35.408Z"
}
```

**2. Liveness Probe**

- **Method**: `GET`
- **URL**: `/health/live`
- **Description**: Checks if the service is running. Does not check the database.
- **Request Headers:**

```json
{
  "method": "GET",
  "url": "http://localhost:4002/health/live",
  "pathParams": {},
  "queryParams": {},
  "headers": {
    "accept": "*/*"
  },
  "body": {}
}
```

- **Response:**

```json
{
  "status": "ok",
  "timestamp": "2025-06-17T09:15:35.408Z"
}
```

**3. Readiness Probe**

- **Method**: `GET`
- **URL**: `/health/ready`
- **Description**: Checks if both the service and the database are ready to accept requests.
- **Request Headers:**

```json
{
  "method": "GET",
  "url": "http://localhost:4002/health/ready",
  "pathParams": {},
  "queryParams": {},
  "headers": {
    "accept": "*/*"
  },
  "body": {}
}
```

- **Response:**

```json
{
  "status": "ok",
  "database": "ready",
  "timestamp": "2025-06-17T09:15:35.408Z"
}
```

---

## Tracking

**1. Get User Journey**

- **Method**: `POST`
- **URL**: `/lms-service/v1/tracking/userjourney`
- **Description**: Retrieves the learning journey of a user within a cohort.
- **Request Headers:**

```json
{
  "method": "POST",
  "url": "http://localhost:4002/lms-service/v1/tracking/userjourney",
  "pathParams": {},
  "queryParams": {},
  "headers": {
    "accept": "application/json",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {
    "userId": "100ba777-ca99-4cea-8ec7-c1ddd763d97b",
    "cohortId": "380340b5-f419-4d9b-bac2-cb765ab89070"
  }
}
```

- **Response:**

```json
{
  "id": "api.tracking.userJourney",
  "ver": "1.0",
  "ts": "2025-06-17T09:15:35.408Z",
  "params": {
    "resmsgid": "msg-000027-1750151735408",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "userId": "100ba777-ca99-4cea-8ec7-c1ddd763d97b",
    "cohortId": "380340b5-f419-4d9b-bac2-cb765ab89070",
    "totalCourses": 5,
    "completedCourses": 2,
    "inProgressCourses": 1,
    "overallProgress": 40
  }
}
```

```

**2. Get Course Tracking Status**

- **Method**: `GET`
- **URL**: `/lms-service/v1/tracking/course/{courseId}/{userId}`
- **Description**: Returns the tracking/progress status of a user for a specific course.
- **Request Headers:**

```json
{
  "method": "GET",
  "url": "http://localhost:4002/lms-service/v1/tracking/course/{courseId}/{userId}",
  "pathParams": {},
  "queryParams": {},
  "headers": {
    "accept": "application/json",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {}
}
```

- **Response:**

```json
{
  "id": "api.tracking.courseStatus",
  "ver": "1.0",
  "ts": "2025-06-17T09:15:35.408Z",
  "params": {
    "resmsgid": "msg-000028-1750151735408",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "courseId": "380340b5-f419-4d9b-bac2-cb765ab89070",
    "userId": "100ba777-ca99-4cea-8ec7-c1ddd763d97b",
    "status": "in_progress",
    "progressPercentage": 60,
    "completedLessons": 6,
    "totalLessons": 10
  }
}
```

```

**3. Update Course Tracking Status**

- **Method**: `PATCH`
- **URL**: `/lms-service/v1/tracking/course/{courseId}/{userId}`
- **Description**: Updates the tracking/progress status of a user for a specific course.
- **Request Headers:**

```json
{
  "method": "PATCH",
  "url": "http://localhost:4002/lms-service/v1/tracking/course/{courseId}/{userId}",
  "pathParams": {},
  "queryParams": {},
  "headers": {
    "accept": "application/json",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {
    "status": "completed",
    "progressPercentage": 100
  }
}
```

- **Response:**

```json
{
  "id": "api.tracking.courseUpdate",
  "ver": "1.0",
  "ts": "2025-06-17T09:15:35.408Z",
  "params": {
    "resmsgid": "msg-000029-1750151735408",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "courseId": "380340b5-f419-4d9b-bac2-cb765ab89070",
    "userId": "100ba777-ca99-4cea-8ec7-c1ddd763d97b",
    "status": "completed",
    "progressPercentage": 100,
    "updatedAt": "2025-06-17T09:20:00.000Z"
  }
}
```

```

**4. Start or Get Lesson Attempt**

- **Method**: `POST`
- **URL**: `/lms-service/v1/tracking/lesson/attempt/{lessonId}`
- **Description**: Starts a new lesson attempt or retrieves an existing incomplete attempt.
- **Request Headers:**

```json
{
  "method": "POST",
  "url": "http://localhost:4002/lms-service/v1/tracking/lesson/attempt/{lessonId}",
  "pathParams": {},
  "queryParams": {},
  "headers": {
    "accept": "application/json",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {
    "userId": "100ba777-ca99-4cea-8ec7-c1ddd763d97b",
    "courseId": "380340b5-f419-4d9b-bac2-cb765ab89070"
  }
}
```

- **Response:**

```json
{
  "id": "api.tracking.lessonAttempt",
  "ver": "1.0",
  "ts": "2025-06-17T09:15:35.408Z",
  "params": {
    "resmsgid": "msg-000030-1750151735408",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 201,
  "result": {
    "attemptId": "attempt-uuid-here",
    "lessonId": "25085c47-21f3-4b59-b0c9-04adaa85f87c",
    "userId": "100ba777-ca99-4cea-8ec7-c1ddd763d97b",
    "status": "in_progress",
    "startedAt": "2025-06-17T09:15:35.401Z"
  }
}
```

```

**5. Start Over or Resume Lesson Attempt**

- **Method**: `GET`
- **URL**: `/lms-service/v1/tracking/lesson/attempt/{lessonId}/{userId}`
- **Description**: Retrieves an existing lesson attempt to resume or start over.
- **Request Headers:**

```json
{
  "method": "GET",
  "url": "http://localhost:4002/lms-service/v1/tracking/lesson/attempt/{lessonId}/{userId}",
  "pathParams": {},
  "queryParams": {},
  "headers": {
    "accept": "application/json",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {}
}
```

- **Response:**

```json
{
  "id": "api.tracking.lessonAttemptResume",
  "ver": "1.0",
  "ts": "2025-06-17T09:15:35.408Z",
  "params": {
    "resmsgid": "msg-000031-1750151735408",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "attemptId": "attempt-uuid-here",
    "lessonId": "25085c47-21f3-4b59-b0c9-04adaa85f87c",
    "userId": "100ba777-ca99-4cea-8ec7-c1ddd763d97b",
    "status": "in_progress",
    "progress": 40,
    "startedAt": "2025-06-17T09:15:35.401Z"
  }
}
```

```

**6. Get Lesson Status for a User**

- **Method**: `GET`
- **URL**: `/lms-service/v1/tracking/{lessonId}/users/{userId}/status`
- **Description**: Returns the completion status of a lesson for a specific user.
- **Request Headers:**

```json
{
  "method": "GET",
  "url": "http://localhost:4002/lms-service/v1/tracking/{lessonId}/users/{userId}/status",
  "pathParams": {},
  "queryParams": {},
  "headers": {
    "accept": "application/json",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {}
}
```

- **Response:**

```json
{
  "id": "api.tracking.lessonStatus",
  "ver": "1.0",
  "ts": "2025-06-17T09:15:35.408Z",
  "params": {
    "resmsgid": "msg-000032-1750151735408",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "lessonId": "25085c47-21f3-4b59-b0c9-04adaa85f87c",
    "userId": "100ba777-ca99-4cea-8ec7-c1ddd763d97b",
    "status": "completed",
    "completedAt": "2025-06-17T09:30:00.000Z"
  }
}
```

```

**7. Get Attempt Details**

- **Method**: `GET`
- **URL**: `/lms-service/v1/tracking/attempts/{attemptId}/{userId}`
- **Description**: Returns the full details of a specific lesson attempt.
- **Request Headers:**

```json
{
  "method": "GET",
  "url": "http://localhost:4002/lms-service/v1/tracking/attempts/{attemptId}/{userId}",
  "pathParams": {},
  "queryParams": {},
  "headers": {
    "accept": "application/json",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {}
}
```

- **Response:**

```json
{
  "id": "api.tracking.attemptDetails",
  "ver": "1.0",
  "ts": "2025-06-17T09:15:35.408Z",
  "params": {
    "resmsgid": "msg-000033-1750151735408",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "attemptId": "attempt-uuid-here",
    "lessonId": "25085c47-21f3-4b59-b0c9-04adaa85f87c",
    "userId": "100ba777-ca99-4cea-8ec7-c1ddd763d97b",
    "status": "completed",
    "progress": 100,
    "startedAt": "2025-06-17T09:15:35.401Z",
    "completedAt": "2025-06-17T09:30:00.000Z"
  }
}
```

```

**8. Update Attempt Progress**

- **Method**: `PATCH`
- **URL**: `/lms-service/v1/tracking/attempts/progress/{attemptId}`
- **Description**: Updates the progress of an ongoing lesson attempt.
- **Request Headers:**

```json
{
  "method": "PATCH",
  "url": "http://localhost:4002/lms-service/v1/tracking/attempts/progress/{attemptId}",
  "pathParams": {},
  "queryParams": {},
  "headers": {
    "accept": "application/json",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {
    "progress": 75,
    "status": "in_progress"
  }
}
```

- **Response:**

```json
{
  "id": "api.tracking.attemptProgress",
  "ver": "1.0",
  "ts": "2025-06-17T09:15:35.408Z",
  "params": {
    "resmsgid": "msg-000034-1750151735408",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "attemptId": "attempt-uuid-here",
    "progress": 75,
    "status": "in_progress",
    "updatedAt": "2025-06-17T09:25:00.000Z"
  }
}
```

```

**9. Update Lesson Completion by Event ID**

- **Method**: `PATCH`
- **URL**: `/lms-service/v1/tracking/event/{eventId}`
- **Description**: Marks a lesson as complete using an event ID trigger.
- **Request Headers:**

```json
{
  "method": "PATCH",
  "url": "http://localhost:4002/lms-service/v1/tracking/event/{eventId}",
  "pathParams": {},
  "queryParams": {},
  "headers": {
    "accept": "application/json",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {
    "userId": "100ba777-ca99-4cea-8ec7-c1ddd763d97b",
    "status": "completed"
  }
}
```

- **Response:**

```json
{
  "id": "api.tracking.eventUpdate",
  "ver": "1.0",
  "ts": "2025-06-17T09:15:35.408Z",
  "params": {
    "resmsgid": "msg-000035-1750151735408",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "eventId": "event-uuid-here",
    "userId": "100ba777-ca99-4cea-8ec7-c1ddd763d97b",
    "status": "completed",
    "updatedAt": "2025-06-17T09:30:00.000Z"
  }
}
```

```

**10. Recalculate Progress**

- **Method**: `POST`
- **URL**: `/lms-service/v1/tracking/recalculate-progress`
- **Description**: Recalculates progress for course tracking and module tracking.
- **Request Headers:**

```json
{
  "method": "POST",
  "url": "http://localhost:4002/lms-service/v1/tracking/recalculate-progress",
  "pathParams": {},
  "queryParams": {},
  "headers": {
    "accept": "application/json",
    "tenantId": "<TENANT_ID>",
    "organisationId": "<ORGANISATION_ID>",
    "Authorization": "Bearer <ACCESS_TOKEN>"
  },
  "body": {
    "userId": "100ba777-ca99-4cea-8ec7-c1ddd763d97b",
    "courseId": "380340b5-f419-4d9b-bac2-cb765ab89070"
  }
}
```

- **Response:**

```json
{
  "id": "api.tracking.recalculate",
  "ver": "1.0",
  "ts": "2025-06-17T09:15:35.408Z",
  "params": {
    "resmsgid": "msg-000036-1750151735408",
    "status": "successful",
    "err": null,
    "errmsg": null
  },
  "responseCode": 200,
  "result": {
    "success": true,
    "message": "Progress recalculated successfully",
    "courseProgress": 60,
    "moduleProgress": [
      {
        "moduleId": "bf7942f1-138b-475f-8c1c-416ae93fd811",
        "progress": 80
      }
    ]
  }
}
```

## Sample Responses

**Generic Success Response:**

```json
{
  "id": "api.lms.service",
  "ver": "1.0",
  "ts": "2025-06-17T11:43:41.411Z",
  "params": {
    "status": "successful"
  },
  "responseCode": 200,
  "result": {
    "success": true
  }
}
```

**Pre-signed URL Response:**

```json
{
  "id": "api.lms.service",
  "ver": "1.0",
  "result": {
    "url": "https://s3.amazonaws.com/...",
    "key": "lms/lessons/sample.png"
  }
}
```

```

```
