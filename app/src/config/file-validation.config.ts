import { createStorage } from "src/common/utils/storage.util";

export interface FileConfig {
  path: string;
  allowedMimeTypes: string[];
  maxSizeInBytes: number;
}

export interface ValidationConfig {
  course: FileConfig;
  module: FileConfig;
  lesson: FileConfig;
  lessonMedia: FileConfig;
  lessonAssociatedMedia: FileConfig;
}

export const validationConfig: ValidationConfig = {
  course: {
      path: '/uploads/courses',
      allowedMimeTypes: ['image/jpeg', 'image/png'],
      maxSizeInBytes: 1 * 1024 * 1024, // 1MB
  },
  module: {
      path: '/uploads/modules',
      allowedMimeTypes: ['image/jpeg', 'image/png'],
      maxSizeInBytes: 1 * 1024 * 1024, // 1MB
  },
  lesson: {
      path: '/uploads/lessons',
      allowedMimeTypes: ['image/jpeg', 'image/png'],
      maxSizeInBytes: 1 * 1024 * 1024, // 1MB
  },
  lessonMedia: {
    path: '/uploads/lessons/media',
    allowedMimeTypes: ['application/pdf'],
    maxSizeInBytes: 10 * 1024 * 1024, // 1MB
},
lessonAssociatedMedia: {
  path: '/uploads/lessons/associated-media',
  allowedMimeTypes: ['application/pdf'],
  maxSizeInBytes: 1 * 1024 * 1024, // 1MB
},
}; 

/**
 * Pre-configured storage configurations
 */
export const uploadConfigs = {
  courses: createStorage('course'),
  modules: createStorage('module'),
  lessons: createStorage('lesson'),
  media: createStorage('lessonMedia'),
  associatedMedia: createStorage('lessonAssociatedMedia'),
}; 