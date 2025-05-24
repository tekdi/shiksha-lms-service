export const API_IDS = {
  // Course APIs
  CREATE_COURSE: 'api.lms.course.create',
  GET_ALL_COURSES: 'api.lms.course.list',
  SEARCH_COURSES: 'api.lms.course.search',
  GET_COURSE_BY_ID: 'api.lms.course.read',
  GET_COURSE_HIERARCHY: 'api.lms.course.hierarchy',
  GET_COURSE_HIERARCHY_WITH_TRACKING: 'api.lms.course.hierarchy.tracking',
  UPDATE_COURSE: 'api.lms.course.update',
  DELETE_COURSE: 'api.lms.course.delete',

  // Module APIs
  CREATE_MODULE: 'api.lms.module.create',
  GET_MODULE_BY_ID: 'api.lms.module.read',
  GET_MODULES_BY_COURSE: 'api.lms.module.list.bycourse',
  GET_SUBMODULES_BY_PARENT: 'api.lms.module.list.byparent',
  UPDATE_MODULE: 'api.lms.module.update',
  DELETE_MODULE: 'api.lms.module.delete',
  
  // Lesson APIs
  CREATE_LESSON: 'api.lms.lesson.create',
  GET_ALL_LESSONS: 'api.lms.lesson.list',
  ADD_LESSON_TO_COURSE: 'api.lms.lesson.course.add',
  GET_LESSON_BY_ID: 'api.lms.lesson.read',
  GET_LESSONS_BY_COURSE: 'api.lms.lesson.list.bycourse',
  GET_LESSONS_BY_MODULE: 'api.lms.lesson.list.bymodule',
  UPDATE_LESSON: 'api.lms.lesson.update',
  DELETE_LESSON: 'api.lms.lesson.delete',
  REMOVE_LESSON_FROM_COURSE: 'api.lms.lesson.course.remove',
  GET_LESSON_TO_DISPLAY: 'api.lms.lesson.display',
  
    // Media APIs
  UPLOAD_MEDIA: 'api.lms.media.upload',
  GET_MEDIA_LIST: 'api.lms.media.list',
  GET_MEDIA_BY_ID: 'api.lms.media.read',
  ASSOCIATE_MEDIA_WITH_LESSON: 'api.lms.media.lesson.associate',
  DELETE_MEDIA: 'api.lms.media.delete',
  REMOVE_MEDIA_ASSOCIATION: 'api.lms.media.lesson.disassociate',
  
   // Enrollment APIs
  ENROLL_USER: 'api.lms.enrollment.create',
  GET_USER_ENROLLMENTS: 'api.lms.enrollment.list.byuser',
  GET_ENROLLMENT_BY_ID: 'api.lms.enrollment.read',
  UPDATE_ENROLLMENT: 'api.lms.enrollment.update',
  CANCEL_ENROLLMENT: 'api.lms.enrollment.cancel',
  
  // Tracking APIs
  START_COURSE_TRACKING: 'api.lms.tracking.course.start',
  UPDATE_COURSE_TRACKING: 'api.lms.tracking.course.update',
  COMPLETE_COURSE_TRACKING: 'api.lms.tracking.course.complete',
  GET_COURSE_TRACKING: 'api.lms.tracking.course.read',
  START_LESSON_TRACKING: 'api.lms.tracking.lesson.start',
  UPDATE_LESSON_TRACKING: 'api.lms.tracking.lesson.update',
  COMPLETE_LESSON_TRACKING: 'api.lms.tracking.lesson.complete',
  GET_LESSON_TRACKING: 'api.lms.tracking.lesson.read',
  GET_LESSON_TRACKING_HISTORY: 'api.lms.tracking.lesson.history',
};