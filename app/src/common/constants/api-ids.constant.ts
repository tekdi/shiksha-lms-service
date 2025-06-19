export const API_IDS = {
  // Course APIs
  CREATE_COURSE: 'api.course.create',
  SEARCH_COURSES: 'api.course.search',
  GET_COURSE_BY_ID: 'api.course.read',
  GET_COURSE_HIERARCHY: 'api.course.hierarchy',
  GET_COURSE_HIERARCHY_WITH_TRACKING: 'api.course.hierarchy.tracking',
  UPDATE_COURSE: 'api.course.update',
  DELETE_COURSE: 'api.course.delete',
  COPY_COURSE: 'api.course.clone',


  // Module APIs
  CREATE_MODULE: 'api.module.create',
  GET_MODULE_BY_ID: 'api.module.read',
  GET_MODULES_BY_COURSE: 'api.module.list',
  GET_SUBMODULES_BY_PARENT: 'api.module.list',
  UPDATE_MODULE: 'api.module.update',
  DELETE_MODULE: 'api.module.delete',
  SAVE_MODULE_ORDER: 'api.module.order.save',
  
  // Lesson APIs
  CREATE_LESSON: 'api.lesson.create',
  GET_ALL_LESSONS: 'api.lesson.list',
  GET_LESSON_BY_ID: 'api.lesson.read',
  GET_LESSONS_BY_MODULE: 'api.lesson.list',
  UPDATE_LESSON: 'api.lesson.update',
  DELETE_LESSON: 'api.lesson.delete',
  
    // Media APIs
  UPLOAD_MEDIA: 'api.media.upload',
  GET_MEDIA_LIST: 'api.media.list',
  GET_MEDIA_BY_ID: 'api.media.read',
  ASSOCIATE_MEDIA_WITH_LESSON: 'api.media.associate.create',
  DELETE_MEDIA: 'api.media.delete',
  REMOVE_MEDIA_ASSOCIATION: 'api.media.associate.delete',
  
   // Enrollment APIs
  ENROLL_USER: 'api.enrollment.create',
  GET_USER_ENROLLMENTS: 'api.enrollment.list',
  GET_ENROLLMENT_BY_ID: 'api.enrollment.read',
  UPDATE_ENROLLMENT: 'api.enrollment.update',
  CANCEL_ENROLLMENT: 'api.enrollment.cancel',

  
  // Tracking APIs
  GET_COURSE_TRACKING: 'api.course.progress.read',
  START_LESSON_ATTEMPT: 'api.lesson.attempt.start',
  MANAGE_LESSON_ATTEMPT: 'api.lesson.attempt.startover',
  GET_LESSON_STATUS: 'api.lesson.attempt.status',
  GET_ATTEMPT: 'api.lesson.attempt.read',
  UPDATE_ATTEMPT_PROGRESS: 'api.lesson.attempt.update',
};