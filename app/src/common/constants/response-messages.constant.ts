export const RESPONSE_MESSAGES = {
  SUCCESS: 'Success',
  CREATED: 'Created successfully',
  UPDATED: 'Updated successfully',
  DELETED: 'Deleted successfully',
  NOT_FOUND: 'Resource not found',
  BAD_REQUEST: 'Bad request',
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Forbidden access',
  SERVER_ERROR: 'Internal server error',

  // Course Specific Messages
  COURSE_CREATED: 'Course created successfully',
  COURSE_UPDATED: 'Course updated successfully',
  COURSE_DELETED: 'Course deleted successfully',
  COURSE_ENROLLED: 'User enrolled for the course successfully',

  // Module Specific Messages
  MODULE_CREATED: 'Module created successfully',
  MODULE_UPDATED: 'Module updated successfully',
  MODULE_DELETED: 'Module deleted successfully',

  // Lesson Specific Messages
  LESSON_CREATED: 'Lesson created successfully',
  LESSON_UPDATED: 'Lesson updated successfully',
  LESSON_DELETED: 'Lesson deleted successfully',
  LESSON_ADDED_TO_COURSE: 'Lesson added to course successfully',
  LESSON_REMOVED_FROM_COURSE: 'Lesson removed from course successfully',

  // Media Specific Messages
  MEDIA_UPLOADED: 'Media uploaded successfully',
  MEDIA_DELETED: 'Media deleted successfully',
  MEDIA_ASSOCIATED: 'Media associated with lesson successfully',
  MEDIA_ASSOCIATION_REMOVED: 'Media association removed successfully',

  // Enrollment Specific Messages
  ENROLLMENT_CREATED: 'User enrolled successfully',
  ENROLLMENT_UPDATED: 'Enrollment updated successfully',
  ENROLLMENT_CANCELLED: 'Enrollment cancelled successfully',

  // Tracking Specific Messages
  TRACKING_STARTED: 'Tracking started successfully',
  TRACKING_UPDATED: 'Tracking updated successfully',
  TRACKING_COMPLETED: 'Tracking completed successfully',

  // Error Messages
  ERROR: {
    COURSE_NOT_FOUND: 'Course not found',
    MODULE_NOT_FOUND: 'Module not found',
    LESSON_NOT_FOUND: 'Lesson not found',
    MEDIA_NOT_FOUND: 'Media not found',
    ENROLLMENT_NOT_FOUND: 'Enrollment not found',
    TRACKING_NOT_FOUND: 'Tracking not found',
    COURSE_ALREADY_EXISTS: 'Course with this title already exists',
    COURSE_ALIAS_ALREADY_EXISTS: 'Course with this alias already exists',
    MODULE_ALREADY_EXISTS: 'Module with this title already exists',
    LESSON_ALREADY_EXISTS: 'Lesson with this title already exists',
    USER_ALREADY_ENROLLED: 'User is already enrolled in this course',
    ENROLLMENT_ALREADY_CANCELLED: 'Enrollment is already cancelled',
    COURSE_ALREADY_COMPLETED: 'Course is already marked as completed',
    LESSON_ALREADY_COMPLETED: 'Lesson is already marked as completed',
    CANNOT_ENROLL_COURSE_ENDED: 'Cannot enroll as course has already ended',
    ENROLLMENT_DISABLED: 'Enrollment is disabled for this course',
    INVALID_API_KEY: 'Invalid API key',
    INVALID_USER_ID: 'Invalid user ID',
    MISSING_TENANT_ID: 'Missing tenant ID',
    INVALID_TENANT_ID: 'Invalid tenant ID',
    RESOURCE_ACCESS_DENIED: 'Access to this resource is denied',
  },

  // Validation Messages
  VALIDATION: {
    REQUIRED_FIELD: 'This field is required',
    INVALID_EMAIL: 'Invalid email format',
    INVALID_UUID: 'Invalid UUID format',
    INVALID_DATE: 'Invalid date format',
    INVALID_NUMBER: 'Invalid number',
    INVALID_STATUS: 'Invalid status value',
    INVALID_BOOLEAN: 'Value must be a boolean',
    INVALID_STRING: 'Value must be a string',
    INVALID_OBJECT: 'Value must be an object',
    INVALID_ARRAY: 'Value must be an array',
    STRING_TOO_SHORT: 'Text is too short',
    STRING_TOO_LONG: 'Text is too long',
    NUMBER_TOO_SMALL: 'Number is too small',
    NUMBER_TOO_LARGE: 'Number is too large',
    INVALID_FILES: 'Invalid file format',
    INVALID_MIMETYPE: 'Invalid file type',
    FILE_TOO_LARGE: 'File size is too large',
    MAX_FILES_EXCEEDED: 'Maximum number of files exceeded',
    INVALID_FORMAT: 'Invalid format',
    INVALID_URL: 'Invalid URL format',
    INVALID_ENUM: 'Invalid enumeration value'
  },
  
  // Success messages group
  SUCCESS_MESSAGES: {
    CREATED: 'Resource created successfully',
    UPDATED: 'Resource updated successfully',
    DELETED: 'Resource deleted successfully',
    FETCHED: 'Resource retrieved successfully'
  }
};