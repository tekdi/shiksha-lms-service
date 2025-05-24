import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { validationConfig } from '../../config/file-validation.config';
import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Custom error class for file validation errors
 */
export class FileValidationError extends HttpException {
  constructor(message: string, status: HttpStatus = HttpStatus.BAD_REQUEST) {
    super(message, status);
  }
}

/**
 * Create storage configuration for different entity types
 * @param entityType The type of entity (course, module, lesson)
 * @returns Multer storage configuration
 */
export const createStorage = (
  entityType: string,
) => {
  const config = validationConfig[entityType];
  
  // Ensure upload directory exists
  const uploadDir = path.resolve(process.cwd(), config.path.replace(/^\//, ''));

  return {
    storage: diskStorage({
      destination: (req, file, callback) => {
        callback(null, uploadDir);
      },
      filename: (req, file, callback) => {
        const fileExtName = path.extname(file.originalname);
        const fileName = `${uuidv4()}${fileExtName}`;
        callback(null, fileName);
      },      
    }),
    limits: {
      fileSize: config.maxSizeInBytes,
    },
    fileFilter: async (req, file, callback) => {
      try {
        // Check file type first
        if (!config.allowedMimeTypes.includes(file.mimetype)) {
          throw new FileValidationError(
            `Invalid file type. Allowed types are: ${config.allowedMimeTypes.join(', ')}`
          );
        }

        callback(null, true);
      } catch (error) {
        if (error instanceof FileValidationError) {
          callback(error, false);
        } else {
          callback(
            new FileValidationError(
              'An unexpected error occurred while processing the file',
              HttpStatus.INTERNAL_SERVER_ERROR
            ),
            false
          );
        }
      }
    },
  };
};