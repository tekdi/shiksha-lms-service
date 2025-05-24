import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Not, Equal, ILike } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Media } from './entities/media.entity';
import { Lesson } from '../lessons/entities/lesson.entity';
import { AssociatedFile } from './entities/associated-file.entity';
import { RESPONSE_MESSAGES } from '../common/constants/response-messages.constant';
import { PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @InjectRepository(Media)
    private readonly mediaRepository: Repository<Media>,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
    @InjectRepository(AssociatedFile)
    private readonly associatedFileRepository: Repository<AssociatedFile>,
  ) {}

  /**
   * Upload media
   */
  async uploadMedia(
    createMediaDto: any,
    file: any,
    userId: string,
    tenantId: string,
  ): Promise<Media> {
    try {
      this.logger.log(`Uploading media: ${JSON.stringify(createMediaDto)}`);

      // Create media record
      const media = this.mediaRepository.create({
        ...createMediaDto,
        path: createMediaDto.path,
        source: createMediaDto.path,
        storage: 'local',
        tenantId,
        createdBy: userId,
        updatedBy: userId,
      });

      const savedMedia = await this.mediaRepository.save(media);
      // TypeORM returns an array when saving an entity, but we need a single entity
      return Array.isArray(savedMedia) ? savedMedia[0] : savedMedia;
    } catch (error) {
      this.logger.error(`Error uploading media: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find all media with pagination and filters
   */
  async findAll(
    paginationDto: PaginationDto,
    filters: any,
    tenantId: string,
  ): Promise<[Media[], number]> {
    try {
      const { page, limit, skip } = paginationDto;
      const { search, type } = filters;

      const queryOptions: any = {
        where: { 
          tenantId
        } as FindOptionsWhere<Media>,
        order: { createdAt: 'DESC' },
        skip,
        take: limit,
      };

      // Add search condition if provided
      if (search) {
        queryOptions.where = [
          { 
            title: ILike(`%${search}%`),
            tenantId,
          } as FindOptionsWhere<Media>,
          { 
            description: ILike(`%${search}%`),
            tenantId, 
          } as FindOptionsWhere<Media>,
        ];
      }

      // Add type filter if provided
      if (type) {
        if (Array.isArray(queryOptions.where)) {
          // If it's already an array of conditions, add type to each
          queryOptions.where = queryOptions.where.map(cond => ({
            ...cond,
            type,
          }));
        } else {
          // Otherwise, add it to the existing condition
          queryOptions.where.type = type;
        }
      }

      return this.mediaRepository.findAndCount(queryOptions);
    } catch (error) {
      this.logger.error(`Error finding media: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Find one media by ID
   */
  async findOne(mediaId: string): Promise<Media> {
    try {
      const media = await this.mediaRepository.findOne({
        where: { mediaId: mediaId } as FindOptionsWhere<Media>,
      });

      if (!media) {
        throw new NotFoundException(RESPONSE_MESSAGES.ERROR.MEDIA_NOT_FOUND);
      }

      return media;
    } catch (error) {
      this.logger.error(`Error finding media: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Associate media with lesson
   */
  async associateWithLesson(mediaId: string, lessonId: string): Promise<Lesson> {
    try {
      // Find the media
      const media = await this.mediaRepository.findOne({
        where: { mediaId: mediaId } as FindOptionsWhere<Media>,
      });

      if (!media) {
        throw new NotFoundException(RESPONSE_MESSAGES.ERROR.MEDIA_NOT_FOUND);
      }

      // Find the lesson
      const lesson = await this.lessonRepository.findOne({
        where: { lessonId: lessonId } as FindOptionsWhere<Lesson>,
      });

      if (!lesson) {
        throw new NotFoundException(RESPONSE_MESSAGES.ERROR.LESSON_NOT_FOUND);
      }

      // Update the lesson with the media
      lesson.mediaId = mediaId;
      lesson.updatedAt = new Date();
      
      return this.lessonRepository.save(lesson);
    } catch (error) {
      this.logger.error(`Error associating media with lesson: ${error.message}`, error.stack);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Remove a media (delete it)
   */
  async remove(mediaId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Find the media to remove
      const media = await this.mediaRepository.findOne({
        where: { mediaId: mediaId } as FindOptionsWhere<Media>,
      });

      if (!media) {
        throw new NotFoundException(RESPONSE_MESSAGES.ERROR.MEDIA_NOT_FOUND);
      }

      // Check if media is associated with any lessons
      const lessons = await this.lessonRepository.find({
        where: { mediaId: mediaId } as FindOptionsWhere<Lesson>,
      });

      if (lessons.length > 0) {
        // Remove the association from all lessons
        for (const lesson of lessons) {
          lesson.mediaId = '';
          lesson.updatedAt = new Date();
          await this.lessonRepository.save(lesson);
        }
      }

      // Remove associated files records
      await this.associatedFileRepository.delete({ mediaId: mediaId } as any);

      // Delete the media file if it exists locally
      if (media.path && media.storage === 'local') {
        try {
          const fullPath = path.join(process.cwd(), media.path);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        } catch (fileError) {
          this.logger.error(`Error deleting media file: ${fileError.message}`);
          // Continue with deletion even if file removal fails
        }
      }

      // Delete the media record
      await this.mediaRepository.delete({ mediaId: mediaId } as FindOptionsWhere<Media>);

      return { success: true, message: RESPONSE_MESSAGES.MEDIA_DELETED || 'Media deleted successfully' };
    } catch (error) {
      this.logger.error(`Error removing media: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Remove media association from lesson
   */
  async removeAssociation(mediaId: string, lessonId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Find the lesson
      const lesson = await this.lessonRepository.findOne({
        where: { lessonId: lessonId } as FindOptionsWhere<Lesson>,
      });

      if (!lesson) {
        throw new NotFoundException(RESPONSE_MESSAGES.ERROR.LESSON_NOT_FOUND);
      }

      // Check if the lesson is associated with the specified media
      if (lesson.mediaId !== mediaId) {
        throw new BadRequestException('The specified lesson is not associated with this media');
      }

      // Remove the association
      lesson.mediaId = '';
      lesson.updatedAt = new Date();
      await this.lessonRepository.save(lesson);

      return { 
        success: true, 
        message: 'Media association removed successfully' 
      };
    } catch (error) {
      this.logger.error(`Error removing media association: ${error.message}`, error.stack);
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }
}