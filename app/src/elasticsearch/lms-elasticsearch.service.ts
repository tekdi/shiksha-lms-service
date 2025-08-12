import { Injectable, Logger } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LessonTrack } from '../tracking/entities/lesson-track.entity';
import { Course } from '../courses/entities/course.entity';
import { Lesson } from '../lessons/entities/lesson.entity';
import { isElasticsearchEnabled } from '../common/utils/elasticsearch.util';

// Define the shared config locally to avoid import path issues
const SHARED_ELASTICSEARCH_CONFIG = {
  indexName: 'users',
  node: process.env.ELASTICSEARCH_HOST || 'http://localhost:9200',
};

@Injectable()
export class LMSElasticsearchService {
  private readonly indexName = SHARED_ELASTICSEARCH_CONFIG.indexName;
  private readonly client: Client;
  private readonly logger = new Logger(LMSElasticsearchService.name);
  private readonly userMicroserviceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectRepository(LessonTrack)
    private readonly lessonTrackRepository: Repository<LessonTrack>,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(Lesson)
    private readonly lessonRepository: Repository<Lesson>,
  ) {
    this.client = new Client({
      node: process.env.ELASTICSEARCH_HOST || SHARED_ELASTICSEARCH_CONFIG.node
    });
    this.userMicroserviceUrl = this.configService.get<string>('USER_MICROSERVICE_URL', 'http://localhost:3002');
  }

  /**
   * Check if user document exists in Elasticsearch
   */
  async checkUserDocumentExists(userId: string): Promise<boolean> {
    if (!isElasticsearchEnabled()) {
      this.logger.debug('Elasticsearch is disabled, returning false for user document check');
      return false;
    }

    try {
      const exists = await this.client.exists({
        index: this.indexName,
        id: userId
      });
      return exists;
    } catch (error) {
      this.logger.error(`Error checking if user document exists for userId: ${userId}:`, error);
      return false;
    }
  }

  /**
   * Check if user has complete courses data in Elasticsearch
   */
  async checkUserHasCompleteCourses(userId: string): Promise<boolean> {
    try {
      const response = await this.client.get({
        index: this.indexName,
        id: userId
      });

      const userData = response._source as any;
      
      // Check if applications exist and have courses data
      if (!userData.applications || !Array.isArray(userData.applications)) {
        return false;
      }

      // Check if any application has courses with values
      for (const application of userData.applications) {
        if (application.courses && 
            application.courses.values && 
            Array.isArray(application.courses.values) && 
            application.courses.values.length > 0) {
          return true;
        }
      }

      return false;
    } catch (error) {
      this.logger.error(`Error checking if user has complete courses for userId: ${userId}:`, error);
      return false;
    }
  }

  /**
   * Check if user document exists and has complete data structure
   */
  async checkUserDocumentComplete(userId: string): Promise<boolean> {
    try {
      const exists = await this.checkUserDocumentExists(userId);
      if (!exists) {
        return false;
      }

      const hasCompleteData = await this.checkUserHasCompleteCourses(userId);
      return hasCompleteData;
    } catch (error) {
      this.logger.error(`Error checking if user document is complete for userId: ${userId}:`, error);
      return false;
    }
  }

  async checkAndCreateUser(userId: string): Promise<void> {
    if (!isElasticsearchEnabled()) {
      this.logger.debug('Elasticsearch is disabled, skipping user document creation');
      return;
    }

    try {
      // Check if user exists
      const exists = await this.client.exists({
        index: this.indexName,
        id: userId
      });

      if (!exists) {
        this.logger.log(`User document not found for userId: ${userId}, triggering full sync from user-microservice`);
        
        try {
          // Call user-microservice sync endpoint to create complete user document
          const response = await this.httpService.axiosRef.post(
            `${this.userMicroserviceUrl}/user/v1/elasticsearch/users/${userId}/sync`,
            {},
            {
              headers: {
                'Content-Type': 'application/json'
              },
              timeout: 60000 // 60 seconds timeout
            }
          );
          
          if (response.status === 200) {
            this.logger.log(`Successfully synced user ${userId} from user-microservice`);
          } else {
            this.logger.warn(`User sync failed with status ${response.status} for userId: ${userId}`);
            // Fallback to creating basic document
            await this.createBasicUserDocument(userId);
          }
        } catch (syncError) {
          this.logger.error(`Error syncing user ${userId} from user-microservice:`, syncError);
          // Fallback to creating basic document
          await this.createBasicUserDocument(userId);
        }
      } else {
        this.logger.debug(`User document already exists for userId: ${userId}`);
      }
    } catch (error) {
      this.logger.error(`Error checking/creating user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Sync all user courses to Elasticsearch
   * This method fetches all courses for a user and syncs them to Elasticsearch
   */
  async syncAllUserCourses(userId: string): Promise<void> {
    if (!isElasticsearchEnabled()) {
      this.logger.debug('Elasticsearch is disabled, skipping user courses sync');
      return;
    }

    try {
      this.logger.log(`Syncing all courses for userId: ${userId}`);
      
      // Always call user-microservice sync to ensure profile and application data are populated
      await this.syncUserFromUserMicroservice(userId);
      
      // Get all lesson tracks for this user (existing progress)
      const lessonTracks = await this.getAllUserLessonTracks(userId);
      
      // Get all available courses and modules for this user
      const allCourses = await this.getAllAvailableCourses(userId);
      
      // Fetch answer data for this user
      const answerData = await this.fetchUserAnswerData(userId);
      
      // Group by cohortId (from course params)
      const coursesByCohort = new Map<string, any[]>();
      
      // Process all available courses, not just those with lesson tracks
      for (const course of allCourses) {
        const cohortId = this.extractCohortIdFromCourse(course);
        if (!coursesByCohort.has(cohortId)) {
          coursesByCohort.set(cohortId, []);
        }
        coursesByCohort.get(cohortId)!.push(course);
      }
      
      // Sync each cohort's courses
      for (const [cohortId, courses] of coursesByCohort) {
        const courseData = this.buildCompleteCourseDataWithAllCourses(courses, lessonTracks);
        
        // Clean up duplicate lessonTrackIds before syncing
        this.cleanupDuplicateLessonTrackIds(courseData);
        
        // Enhance course data with answer data
        if (answerData.length > 0) {
          this.enhanceCourseDataWithAnswers(courseData, answerData);
        }
        
        await this.updateCourseProgress(userId, cohortId, courseData);
      }
      
      this.logger.log(`Successfully synced ${coursesByCohort.size} cohorts for userId: ${userId}`);
    } catch (error) {
      this.logger.error(`Error syncing all user courses for userId: ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Always sync user from user-microservice to ensure profile and application data are populated
   */
  private async syncUserFromUserMicroservice(userId: string): Promise<void> {
    try {
      this.logger.log(`Syncing user ${userId} from user-microservice to ensure profile and application data`);

      // Call user-microservice sync endpoint to create/update complete user document
      const response = await this.httpService.axiosRef.post(
        `${this.userMicroserviceUrl}/user/v1/elasticsearch/users/${userId}/sync`,
        {},
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000 // Reduced to 30 seconds timeout
        }
      );

      if (response.status === 200) {
        this.logger.log(`Successfully synced user ${userId} from user-microservice`);
      } else {
        this.logger.warn(`User sync failed with status ${response.status} for userId: ${userId}`);
        // Don't throw error, continue with course sync
      }
    } catch (syncError) {
      this.logger.error(`Error syncing user ${userId} from user-microservice:`, syncError);
      // Don't throw error, continue with course sync
    }
  }

  /**
   * Get all lesson tracks for a user with course and lesson relations
   */
  private async getAllUserLessonTracks(userId: string): Promise<any[]> {
    try {
      const lessonTracks = await this.lessonTrackRepository.find({
        where: { userId },
        relations: ['course', 'lesson'],
        order: {
          courseId: 'ASC',
          lessonId: 'ASC'
        }
      });
      
      this.logger.log(`Found ${lessonTracks.length} lesson tracks for userId: ${userId}`);
      return lessonTracks;
    } catch (error) {
      this.logger.error(`Error fetching lesson tracks for userId: ${userId}:`, error);
      return [];
    }
  }

  /**
   * Extract cohortId from course params
   */
  private extractCohortIdFromCourse(course: any): string {
    if (course?.params?.cohortId) {
      return course.params.cohortId;
    }
    return 'default-cohort';
  }

  /**
   * Build complete course data structure from lesson tracks
   */
  private buildCompleteCourseData(lessonTracks: any[]): any {
    // Group lesson tracks by courseId
    const coursesByCourseId = new Map<string, any[]>();
    
    for (const lessonTrack of lessonTracks) {
      const courseId = lessonTrack.courseId;
      if (!coursesByCourseId.has(courseId)) {
        coursesByCourseId.set(courseId, []);
      }
      coursesByCourseId.get(courseId)!.push(lessonTrack);
    }
    
    const courses: any[] = [];
    
    for (const [courseId, lessonTracks] of coursesByCourseId) {
      const course = lessonTracks[0]?.course;
      const units: any[] = [];
      
      // Group lessons by unit (for now, treat each course as a unit)
      const unit = {
        unitId: courseId,
        unitTitle: course?.title || 'Course Unit',
        progress: this.calculateAverageProgress(lessonTracks),
        contents: {
          type: 'nested',
          values: lessonTracks.map(lessonTrack => ({
            contentId: lessonTrack.lessonId,
            type: lessonTrack.lesson?.format || 'video',
            title: lessonTrack.lesson?.title || 'Unknown Lesson',
            status: this.getLessonStatus(lessonTrack), // Enhanced status determination
            tracking: this.buildContentTracking(lessonTrack.lesson?.format || 'video', lessonTrack)
          }))
        }
      };
      
      units.push(unit);
      
      const courseData = {
        courseId: courseId,
        courseTitle: course?.title || 'Unknown Course',
        progress: this.calculateAverageProgress(lessonTracks),
        units: {
          type: 'nested',
          values: units
        }
      };
      
      courses.push(courseData);
    }
    
    return {
      type: 'nested',
      values: courses
    };
  }

  /**
   * Determine lesson status based on completion data
   */
  private getLessonStatus(lessonTrack: any): string {
    // Check if lesson is completed based on various criteria
    if (lessonTrack.status === 'completed' || 
        lessonTrack.status === 'COMPLETED' ||
        lessonTrack.completionPercentage >= 100 ||
        (lessonTrack.currentPosition && lessonTrack.totalContent && 
         lessonTrack.currentPosition >= lessonTrack.totalContent)) {
      return 'complete';
    }
    
    // Check if lesson has been started
    if (lessonTrack.status === 'started' || 
        lessonTrack.status === 'STARTED' ||
        lessonTrack.completionPercentage > 0 ||
        lessonTrack.currentPosition > 0) {
      return 'incomplete';
    }
    
    // Default to incomplete if no progress data
    return 'incomplete';
  }

  /**
   * Calculate average progress from lesson tracks
   */
  private calculateAverageProgress(lessonTracks: any[]): number {
    if (lessonTracks.length === 0) return 0;
    
    const totalProgress = lessonTracks.reduce((sum, track) => sum + (track.completionPercentage || 0), 0);
    return Math.round(totalProgress / lessonTracks.length);
  }

  /**
   * Build content tracking based on lesson format
   */
  private buildContentTracking(lessonFormat: string, lessonTrack: any): any {
    const baseTracking = {
      percentComplete: lessonTrack.completionPercentage || 0,
      timeSpent: lessonTrack.timeSpent || 0
    };

    switch (lessonFormat) {
      case 'video':
        return {
          ...baseTracking,
          lastPosition: Math.floor(lessonTrack.currentPosition || 0),
          currentPosition: Math.floor(lessonTrack.currentPosition || 0)
        };
      case 'document':
        return {
          ...baseTracking,
          visitedPages: [1, 2, 3],
          totalPages: 10,
          lastPage: 3,
          currentPage: 3
        };
      case 'test':
        return {
          ...baseTracking,
          questionsAttempted: 5,
          totalQuestions: 10,
          score: lessonTrack.score || 0,
          answers: {
            type: 'nested',
            values: []
          }
        };
      case 'text_and_media':
        return {
          ...baseTracking,
          lastPosition: Math.floor(lessonTrack.currentPosition || 0),
          currentPosition: Math.floor(lessonTrack.currentPosition || 0)
        };
      default:
        return baseTracking;
    }
  }

  private async createBasicUserDocument(userId: string): Promise<void> {
    try {
      // Create basic user document as fallback
      await this.client.index({
        index: this.indexName,
        id: userId,
        body: {
          userId: userId,
          profile: {},
          applications: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      });
      this.logger.log(`Created basic user document for userId: ${userId} (fallback)`);
    } catch (error) {
      this.logger.error(`Error creating basic user document for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Clean up duplicate content entries in a document
   */
  private cleanupDuplicateContent(document: any): any {
    const cleanedDoc = JSON.parse(JSON.stringify(document));
    
    if (!cleanedDoc.applications) return cleanedDoc;
    
    for (const application of cleanedDoc.applications) {
      if (!application.courses?.values) continue;
      
      for (const course of application.courses.values) {
        if (!course.units?.values) continue;
        
        // Track unique lessons across all units to prevent duplicates
        const uniqueLessons = new Map();
        
        for (const unit of course.units.values) {
          if (!unit.contents?.values) continue;
          
          // Create a map to track unique content by contentId within this unit
          const uniqueContents = new Map();
          
          for (const content of unit.contents.values) {
            const contentId = content.contentId || content.lessonId;
            const lessonId = content.lessonId;
            if (!contentId) continue;
            
            // Create a unique key that includes both contentId and lessonId
            const uniqueKey = `${contentId}-${lessonId}`;
            
            // If content with same contentId exists within this unit, keep the one with lessonTrackId
            if (uniqueContents.has(contentId)) {
              const existingContent = uniqueContents.get(contentId);
              const newContent = content;
              
              // Prefer content with lessonTrackId
              if (newContent.lessonTrackId && !existingContent.lessonTrackId) {
                uniqueContents.set(contentId, newContent);
              } else if (existingContent.lessonTrackId && !newContent.lessonTrackId) {
                // Keep existing content with lessonTrackId
                continue;
              } else {
                // If both have lessonTrackId, keep the one with higher progress
                const existingProgress = existingContent.tracking?.percentComplete || 0;
                const newProgress = newContent.tracking?.percentComplete || 0;
                
                if (newProgress > existingProgress) {
                  uniqueContents.set(contentId, newContent);
                }
              }
            } else {
              uniqueContents.set(contentId, content);
            }
            
            // Check if this lesson already exists in another unit
            if (uniqueLessons.has(uniqueKey)) {
              const existingLesson = uniqueLessons.get(uniqueKey);
              const newLesson = content;
              
              // Prefer lesson with lessonTrackId
              if (newLesson.lessonTrackId && !existingLesson.lessonTrackId) {
                uniqueLessons.set(uniqueKey, newLesson);
                // Remove from current unit since it's a duplicate
                continue;
              } else if (existingLesson.lessonTrackId && !newLesson.lessonTrackId) {
                // Keep existing lesson with lessonTrackId, remove this one
                continue;
              } else {
                // If both have lessonTrackId, keep the one with higher progress
                const existingProgress = existingLesson.tracking?.percentComplete || 0;
                const newProgress = newLesson.tracking?.percentComplete || 0;
                
                if (newProgress > existingProgress) {
                  uniqueLessons.set(uniqueKey, newLesson);
                  // Remove from current unit since it's a duplicate
                  continue;
                } else {
                  // Keep existing lesson, remove this one
                  continue;
                }
              }
            } else {
              uniqueLessons.set(uniqueKey, content);
            }
          }
          
          // Replace contents array with unique contents for this unit
          unit.contents.values = Array.from(uniqueContents.values());
        }
      }
    }
    
    return cleanedDoc;
  }

  /**
   * Update specific course content with duplicate prevention
   */
  async updateSpecificCourseContent(
    userId: string, 
    cohortId: string, 
    courseId: string, 
    lessonTrackId: string, 
    contentData: any
  ): Promise<any> {
    if (!isElasticsearchEnabled()) {
      this.logger.debug('Elasticsearch is disabled, skipping specific course content update');
      return;
    }

    try {
      this.logger.log(`Updating specific content for userId: ${userId}, cohortId: ${cohortId}, courseId: ${courseId}, lessonTrackId: ${lessonTrackId}`);

      // First check if user document exists
      const userExists = await this.checkUserDocumentExists(userId);
      
      if (!userExists) {
        this.logger.log(`User document not found for userId: ${userId}, triggering comprehensive sync`);
        await this.triggerComprehensiveSync(userId, courseId, lessonTrackId, contentData);
        return;
      }

      // Check if course structure exists, if not create it
      await this.ensureCourseStructureExists(userId, cohortId, courseId, contentData);

      // First try the script approach
      try {
        await this.client.update({
          index: this.indexName,
          id: userId,
          body: {
            script: {
              source: `
                // Find application by cohortId
                for (int i = 0; i < ctx._source.applications.length; i++) {
                  if (ctx._source.applications[i].cohortId == params.cohortId) {
                    // Find course by courseId
                    for (int j = 0; j < ctx._source.applications[i].courses.values.length; j++) {
                      if (ctx._source.applications[i].courses.values[j].courseId == params.courseId) {
                        // Find unit by courseId (since unitId is same as courseId in this structure)
                        for (int k = 0; k < ctx._source.applications[i].courses.values[j].units.values.length; k++) {
                          if (ctx._source.applications[i].courses.values[j].units.values[k].unitId == params.courseId) {
                            // Find content by lessonTrackId first, then by contentId and lessonId
                            boolean contentFound = false;
                            for (int l = 0; l < ctx._source.applications[i].courses.values[j].units.values[k].contents.values.length; l++) {
                              def content = ctx._source.applications[i].courses.values[j].units.values[k].contents.values[l];
                              
                              // Check for lessonTrackId match first (most specific)
                              if (content.lessonTrackId == params.lessonTrackId) {
                                // Update existing content with same lessonTrackId
                                ctx._source.applications[i].courses.values[j].units.values[k].contents.values[l] = params.contentData;
                                contentFound = true;
                                break;
                              }
                              
                              // Check for contentId and lessonId match (for same lesson in different units)
                              if (content.contentId == params.contentData.lessonId && content.lessonId == params.contentData.lessonId) {
                                // Only update if it doesn't already have a lessonTrackId
                                if (!content.lessonTrackId) {
                                  ctx._source.applications[i].courses.values[j].units.values[k].contents.values[l] = params.contentData;
                                  contentFound = true;
                                  break;
                                }
                              }
                            }
                            
                            // If content not found, add new content
                            if (!contentFound) {
                              // Check if content with same lessonTrackId already exists in any unit
                              boolean duplicateFound = false;
                              for (int m = 0; m < ctx._source.applications[i].courses.values[j].units.values.length; m++) {
                                if (ctx._source.applications[i].courses.values[j].units.values[m].contents != null) {
                                  for (int n = 0; n < ctx._source.applications[i].courses.values[j].units.values[m].contents.values.length; n++) {
                                    def existingContent = ctx._source.applications[i].courses.values[j].units.values[m].contents.values[n];
                                    if (existingContent.lessonTrackId == params.lessonTrackId) {
                                      duplicateFound = true;
                                      break;
                                    }
                                  }
                                }
                                if (duplicateFound) break;
                              }
                              
                              if (!duplicateFound) {
                                ctx._source.applications[i].courses.values[j].units.values[k].contents.values.add(params.contentData);
                              }
                            }
                            return;
                          }
                        }
                        // If unit not found, create new unit
                        def newUnit = [
                          unitId: params.contentData.unitId ?: params.courseId + "-unit",
                          unitTitle: params.contentData.unitTitle ?: params.contentData.title,
                          progress: params.contentData.tracking.percentComplete,
                          contents: [
                            values: [params.contentData],
                            type: "nested"
                          ]
                        ];
                        ctx._source.applications[i].courses.values[j].units.values.add(newUnit);
                        return;
                      }
                    }
                    // If course not found, create new course
                    def newCourse = [
                      courseId: params.courseId,
                      courseTitle: params.contentData.courseTitle ?: params.contentData.title,
                      progress: params.contentData.tracking.percentComplete,
                      units: [
                        values: [[
                          unitId: params.contentData.unitId ?: params.courseId + "-unit",
                          unitTitle: params.contentData.unitTitle ?: params.contentData.title,
                          progress: params.contentData.tracking.percentComplete,
                          contents: [
                            values: [params.contentData],
                            type: "nested"
                          ]
                        ]],
                        type: "nested"
                      ]
                    ];
                    ctx._source.applications[i].courses.values.add(newCourse);
                    return;
                  }
                }
              `,
              lang: 'painless',
              params: {
                cohortId: cohortId,
                courseId: courseId,
                lessonTrackId: lessonTrackId,
                contentData: contentData
              }
            }
          }
        });
      } catch (scriptError) {
        this.logger.warn(`Script approach failed, trying fallback method: ${scriptError.message}`);

        // Fallback: Get current document, update manually, then save
        let currentDoc;
        try {
          currentDoc = await this.client.get({
            index: this.indexName,
            id: userId
          });
        } catch (getError) {
          // If document doesn't exist, trigger comprehensive sync
          if (getError.message.includes('document missing') || getError.message.includes('found:false')) {
            this.logger.log(`Document not found for userId: ${userId}, triggering comprehensive sync`);
            await this.triggerComprehensiveSync(userId, courseId, lessonTrackId, contentData);
            return;
          } else {
            throw getError;
          }
        }

        // Clean up any existing duplicates before updating
        const cleanedDoc = this.cleanupDuplicateContent(currentDoc._source);
        
        const updatedDoc = this.updateContentInDocument(
          cleanedDoc,
          cohortId,
          courseId,
          lessonTrackId,
          contentData
        );

        await this.client.update({
          index: this.indexName,
          id: userId,
          body: {
            doc: updatedDoc
          }
        });
      }

      this.logger.log(`Successfully updated specific content for userId: ${userId}, lessonTrackId: ${lessonTrackId}`);
    } catch (error) {
      this.logger.error(`Error updating specific content for userId: ${userId}, lessonTrackId: ${lessonTrackId}`, error);
      throw error;
    }
  }

  /**
   * Trigger comprehensive sync when user document doesn't exist
   */
  private async triggerComprehensiveSync(userId: string, courseId: string, lessonTrackId: string, contentData: any): Promise<void> {
    try {
      this.logger.log(`Triggering comprehensive sync for userId: ${userId}`);
      
      // Use the new syncAllUserCourses method that includes all available courses
      await this.syncAllUserCourses(userId);
      
      this.logger.log(`Comprehensive sync completed for userId: ${userId}`);
    } catch (syncError) {
      this.logger.error(`Failed to sync user ${userId} via comprehensive sync:`, syncError);
      
      // Fallback to creating basic document structure
      this.logger.log(`Creating basic document structure for userId: ${userId}`);
      await this.createBasicUserDocument(userId);
      
      // Try to update the content in the basic document
      try {
        // Extract cohortId from course hierarchy or use courseId as default
        const courseHierarchy = await this.getCourseHierarchyForUser(userId, courseId);
        const cohortId = courseHierarchy?.params?.cohortId || courseId;
        
        const basicDoc = {
          _source: {
            userId: userId,
            applications: [{
              cohortId: cohortId,
              courses: {
                type: "nested",
                values: []
              }
            }]
          }
        };

        const updatedDoc = this.updateContentInDocument(
          basicDoc._source,
          cohortId,
          courseId,
          lessonTrackId,
          contentData
        );

        await this.client.update({
          index: this.indexName,
          id: userId,
          body: {
            doc: updatedDoc
          }
        });
        
        this.logger.log(`Successfully created and updated basic document for userId: ${userId}`);
      } catch (updateError) {
        this.logger.error(`Failed to update basic document for userId: ${userId}:`, updateError);
        throw updateError;
      }
    }
  }

  /**
   * Get course hierarchy data for a specific user and course
   */
  private async getCourseHierarchyForUser(userId: string, courseId: string): Promise<any> {
    try {
      // Get course with modules and lessons
      const course = await this.courseRepository.findOne({
        where: { courseId },
        relations: ['modules', 'modules.lessons']
      });

      if (!course) {
        this.logger.warn(`Course not found for courseId: ${courseId}`);
        return null;
      }

      // Get user's lesson tracks for this course
      const lessonTracks = await this.lessonTrackRepository.find({
        where: { userId, courseId },
        relations: ['lesson']
      });

      // Build course hierarchy with tracking data
      const courseHierarchy = {
        courseId: course.courseId,
        name: course.title,
        params: course.params,
        modules: course.modules?.map(module => ({
          moduleId: module.moduleId,
          name: module.title,
          lessons: module.lessons?.map(lesson => {
            const lessonTrack = lessonTracks.find(lt => lt.lessonId === lesson.lessonId);
            return {
              lessonId: lesson.lessonId,
              name: lesson.title,
              format: lesson.format,
              status: lessonTrack ? this.getLessonStatus(lessonTrack) : 'incomplete',
              tracking: lessonTrack ? this.buildContentTracking(lesson.format, lessonTrack) : {
                timeSpent: 0,
                currentPosition: 0,
                lastPosition: 0,
                percentComplete: 0
              }
            };
          }) || []
        })) || []
      };

      this.logger.log(`Built course hierarchy for userId: ${userId}, courseId: ${courseId}`);
      return courseHierarchy;
    } catch (error) {
      this.logger.error(`Error getting course hierarchy for userId: ${userId}, courseId: ${courseId}:`, error);
      return null;
    }
  }

  /**
   * Fallback method to update content in document structure
   */
  private updateContentInDocument(
    document: any,
    cohortId: string,
    courseId: string,
    lessonTrackId: string,
    contentData: any
  ): any {
    // Deep clone the document to avoid modifying the original
    const updatedDoc = JSON.parse(JSON.stringify(document));

    // Find the application by cohortId
    let application = updatedDoc.applications?.find((app: any) => app.cohortId === cohortId);
    if (!application) {
      this.logger.warn(`Application not found for cohortId: ${cohortId}, creating new application`);
      // Create new application if it doesn't exist
      const newApplication = {
        cohortId: cohortId,
        courses: {
          type: "nested",
          values: []
        }
      };
      if (!updatedDoc.applications) {
        updatedDoc.applications = [];
      }
      updatedDoc.applications.push(newApplication);
      application = newApplication; // Use the newly created application
    }

    // Find the course by courseId
    let course = application.courses?.values?.find((c: any) => c.courseId === courseId);
    if (!course) {
      this.logger.warn(`Course not found for courseId: ${courseId}, creating new course`);
      // Create new course if it doesn't exist
      const newCourse = {
        courseId: courseId,
        courseTitle: contentData.title || 'Unknown Course',
        progress: contentData.tracking?.percentComplete || 0,
        units: {
          type: "nested",
          values: []
        }
      };
      if (!application.courses) {
        application.courses = { values: [], type: "nested" };
      }
      application.courses.values.push(newCourse);
      course = newCourse; // Use the newly created course
    }

    // Find the unit by courseId (since unitId is same as courseId in this structure)
    let unit = course.units?.values?.find((u: any) => u.unitId === courseId);
    if (!unit) {
      this.logger.warn(`Unit not found for courseId: ${courseId}, creating new unit`);
      // Create new unit if it doesn't exist
      const newUnit = {
        unitId: courseId,
        unitTitle: contentData.title || 'Unknown Unit',
        progress: contentData.tracking?.percentComplete || 0,
        contents: {
          type: "nested",
          values: []
        }
      };
      if (!course.units) {
        course.units = { values: [], type: "nested" };
      }
      course.units.values.push(newUnit);
      unit = newUnit; // Use the newly created unit
    }

    // Find existing content by lessonTrackId first, then by contentId
    let existingContentIndex = -1;
    
    if (unit.contents?.values) {
      // First, try to find by lessonTrackId (most specific) - this should be unique
      existingContentIndex = unit.contents.values.findIndex((c: any) => c.lessonTrackId === lessonTrackId);
      
      // If not found by lessonTrackId, try to find by contentId (which is lessonId) but only if it doesn't have a lessonTrackId
      if (existingContentIndex === -1) {
        existingContentIndex = unit.contents.values.findIndex((c: any) => 
          c.contentId === contentData.lessonId && !c.lessonTrackId
        );
      }
      
      // If still not found, try to find by lessonId but only if it doesn't have a lessonTrackId
      if (existingContentIndex === -1) {
        existingContentIndex = unit.contents.values.findIndex((c: any) => 
          c.lessonId === contentData.lessonId && !c.lessonTrackId
        );
      }
    }

    // Ensure contents array exists
    if (!unit.contents) {
      unit.contents = { values: [], type: "nested" };
    }

    if (existingContentIndex !== -1) {
      // Update existing content
      this.logger.log(`Updating existing content at index ${existingContentIndex} for lessonTrackId: ${lessonTrackId}`);
      
      // Preserve existing fields and overlay new data
      const existingContent = unit.contents.values[existingContentIndex];
      unit.contents.values[existingContentIndex] = {
        ...existingContent,
        ...contentData,
        contentId: contentData.lessonId, // Ensure contentId is lessonId
        lessonTrackId: lessonTrackId, // Ensure lessonTrackId is set
        lessonId: contentData.lessonId // Ensure lessonId is set
      };
    } else {
      // Check if we already have a content with this lessonTrackId to prevent duplicates
      const existingContentWithTrackId = unit.contents.values.find((c: any) => c.lessonTrackId === lessonTrackId);
      
      if (existingContentWithTrackId) {
        this.logger.warn(`Content with lessonTrackId ${lessonTrackId} already exists, skipping duplicate creation`);
        return updatedDoc;
      }
      
      // Add new content
      this.logger.log(`Adding new content for lessonTrackId: ${lessonTrackId}`);
      
      const newContent = {
        ...contentData,
        contentId: contentData.lessonId, // Ensure contentId is lessonId
        lessonTrackId: lessonTrackId, // Ensure lessonTrackId is set
        lessonId: contentData.lessonId // Ensure lessonId is set
      };
      
      unit.contents.values.push(newContent);
    }

    // Update unit progress based on content progress
    if (unit.contents.values.length > 0) {
      const totalProgress = unit.contents.values.reduce((sum: number, content: any) => {
        return sum + (content.tracking?.percentComplete || 0);
      }, 0);
      unit.progress = Math.round(totalProgress / unit.contents.values.length);
    }

    // Update course progress based on unit progress
    if (course.units?.values?.length > 0) {
      const totalCourseProgress = course.units.values.reduce((sum: number, unit: any) => {
        return sum + (unit.progress || 0);
      }, 0);
      course.progress = Math.round(totalCourseProgress / course.units.values.length);
    }

    return updatedDoc;
  }

  async updateCourseProgress(userId: string, cohortId: string, courseData: any) {
    if (!isElasticsearchEnabled()) {
      this.logger.debug('Elasticsearch is disabled, skipping course progress update');
      return;
    }

    try {
      // First, ensure user exists
      await this.checkAndCreateUser(userId);

      // Update courses within applications using script
      await this.client.update({
        index: this.indexName,
        id: userId,
        body: {
          script: {
            source: `
              // Find application by cohortId
              boolean found = false;
              for (int i = 0; i < ctx._source.applications.length; i++) {
                if (ctx._source.applications[i].cohortId == params.cohortId) {
                  // Update or add courses
                  if (ctx._source.applications[i].courses == null) {
                    ctx._source.applications[i].courses = params.courses;
                  } else {
                    // Update existing courses
                    ctx._source.applications[i].courses = params.courses;
                  }
                  found = true;
                  break;
                }
              }
              
              // If application not found, create new one
              if (!found) {
                Map newApp = new HashMap();
                newApp.put('cohortId', params.cohortId);
                newApp.put('courses', params.courses);
                newApp.put('progress', new HashMap());
                newApp.put('formData', new HashMap());
                ctx._source.applications.add(newApp);
              }
              
              ctx._source.updatedAt = params.updatedAt;
            `,
            params: { 
              cohortId, 
              courses: courseData,
              updatedAt: new Date().toISOString()
            }
          }
        }
      });
      
      this.logger.log(`Updated course progress for userId: ${userId}, cohortId: ${cohortId}`);
    } catch (error) {
      this.logger.error(`Error updating course progress for userId: ${userId}, cohortId: ${cohortId}:`, error);
      throw error;
    }
  }

  async initializeCourseStructure(userId: string, cohortId: string, courseData: any) {
    if (!isElasticsearchEnabled()) {
      this.logger.debug('Elasticsearch is disabled, skipping course structure initialization');
      return;
    }

    try {
      // First, ensure user exists
      await this.checkAndCreateUser(userId);

      // Initialize course structure
      await this.client.update({
        index: this.indexName,
        id: userId,
        body: {
          script: {
            source: `
              // Find application by cohortId
              boolean found = false;
              for (int i = 0; i < ctx._source.applications.length; i++) {
                if (ctx._source.applications[i].cohortId == params.cohortId) {
                  // Initialize courses structure
                  ctx._source.applications[i].courses = params.courses;
                  found = true;
                  break;
                }
              }
              
              // If application not found, create new one
              if (!found) {
                Map newApp = new HashMap();
                newApp.put('cohortId', params.cohortId);
                newApp.put('courses', params.courses);
                newApp.put('progress', new HashMap());
                newApp.put('formData', new HashMap());
                ctx._source.applications.add(newApp);
              }
              
              ctx._source.updatedAt = params.updatedAt;
            `,
            params: { 
              cohortId, 
              courses: courseData,
              updatedAt: new Date().toISOString()
            }
          }
        }
      });
      
      this.logger.log(`Initialized course structure for userId: ${userId}, cohortId: ${cohortId}`);
    } catch (error) {
      this.logger.error(`Error initializing course structure for userId: ${userId}, cohortId: ${cohortId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch answer data for a user from assessment service
   * This ensures that when we sync course data, we also include any existing quiz answers
   */
  private async fetchUserAnswerData(userId: string): Promise<any[]> {
    try {
      this.logger.log(`Fetching answer data for userId: ${userId}`);
      
      // Note: Assessment service doesn't have an endpoint to get all attempts for a user
      // This method will be enhanced when such an endpoint is available
      // For now, return empty array to avoid errors
      this.logger.warn(`Assessment service doesn't have endpoint to get all attempts for user ${userId}`);
      return [];
      
      // TODO: Implement when assessment service has getUserAttempts endpoint
      // const assessmentServiceUrl = process.env.ASSESSMENT_SERVICE_URL || 'http://localhost:4000';
      // const response = await this.httpService.axiosRef.get(`${assessmentServiceUrl}/assessment-service/v1/attempts/user/${userId}`, {
      //   headers: {
      //     'Content-Type': 'application/json'
      //   },
      //   timeout: 10000
      // });
    } catch (error) {
      this.logger.error(`Failed to fetch answer data for userId: ${userId}:`, error);
      return [];
    }
  }

  private enhanceCourseDataWithAnswers(courseData: any, answerData: any[]) {
    const courseId = courseData.courseId;
    const enhancedCourseData = { ...courseData };

    const answersByTestId = new Map<string, any>();
    answerData.forEach(answer => {
      answersByTestId.set(answer.testId, answer);
    });

    enhancedCourseData.units.values.forEach((unit: any) => {
      unit.contents.values.forEach((content: any) => {
        if (content.type === 'test') {
          const testAnswers = answersByTestId.get(content.contentId);
          if (testAnswers) {
            content.answers = testAnswers.answers;
            content.percentComplete = testAnswers.percentComplete;
            content.timeSpent = testAnswers.timeSpent;
          }
        }
      });
    });

    // Update the original courseData reference
    Object.assign(courseData, enhancedCourseData);
  }

  /**
   * Get all available courses and modules for a user
   */
  private async getAllAvailableCourses(userId: string): Promise<any[]> {
    try {
      // Get all courses that the user has access to
      // This should include courses from user's cohort, enrollment, etc.
      const courses = await this.courseRepository.find({
        where: { status: 'published' as any },
        relations: ['modules', 'modules.lessons'],
        order: {
          title: 'ASC'
        }
      });
      
      this.logger.log(`Found ${courses.length} available courses for userId: ${userId}`);
      return courses;
    } catch (error) {
      this.logger.error(`Error fetching available courses for userId: ${userId}:`, error);
      return [];
    }
  }

  /**
   * Build complete course data including all available courses and modules
   */
  private buildCompleteCourseDataWithAllCourses(courses: any[], lessonTracks: any[]): any {
    // Create a map of lesson tracks by courseId and lessonId for quick lookup
    const lessonTrackMap = new Map<string, any>();
    for (const track of lessonTracks) {
      const key = `${track.courseId}-${track.lessonId}`;
      lessonTrackMap.set(key, track);
    }
    
    const courseValues: any[] = [];
    
    for (const course of courses) {
      const units: any[] = [];
      
      // Process each module as a unit
      if (course.modules && course.modules.length > 0) {
        for (const module of course.modules) {
          const moduleContents: any[] = [];
          
          // Process lessons in this module
          if (module.lessons && module.lessons.length > 0) {
            for (const lesson of module.lessons) {
              const trackKey = `${course.courseId}-${lesson.lessonId}`;
              const lessonTrack = lessonTrackMap.get(trackKey);
              
              const content: any = {
                contentId: lesson.lessonId,
                lessonId: lesson.lessonId,
                type: lesson.format || 'video',
                title: lesson.title || 'Unknown Lesson',
                status: lessonTrack ? this.getLessonStatus(lessonTrack) : 'incomplete',
                tracking: lessonTrack ? this.buildContentTracking(lesson.format || 'video', lessonTrack) : {
                  timeSpent: 0,
                  currentPosition: 0,
                  lastPosition: 0,
                  percentComplete: 0
                }
              };
              
              // Add lessonTrackId if available
              if (lessonTrack) {
                content.lessonTrackId = lessonTrack.lessonTrackId;
              }
              
              moduleContents.push(content);
            }
          }
          
          // Calculate module progress
          const moduleProgress = moduleContents.length > 0 
            ? Math.round(moduleContents.reduce((sum, content) => sum + (content.tracking?.percentComplete || 0), 0) / moduleContents.length)
            : 0;
          
          const unit = {
            unitId: module.moduleId,
            unitTitle: module.title || 'Unknown Module',
            progress: moduleProgress,
            contents: {
              type: 'nested',
              values: moduleContents
            }
          };
          
          units.push(unit);
        }
      } else {
        // If no modules, treat the course as a single unit
        const courseContents: any[] = [];
        
        // Get lesson tracks for this course
        const courseLessonTracks = lessonTracks.filter(track => track.courseId === course.courseId);
        
        for (const lessonTrack of courseLessonTracks) {
          const content: any = {
            contentId: lessonTrack.lessonId,
            lessonId: lessonTrack.lessonId,
            lessonTrackId: lessonTrack.lessonTrackId,
            type: lessonTrack.lesson?.format || 'video',
            title: lessonTrack.lesson?.title || 'Unknown Lesson',
            status: this.getLessonStatus(lessonTrack),
            tracking: this.buildContentTracking(lessonTrack.lesson?.format || 'video', lessonTrack)
          };
          
          courseContents.push(content);
        }
        
        // Calculate course progress
        const courseProgress = courseLessonTracks.length > 0 
          ? Math.round(courseLessonTracks.reduce((sum, track) => sum + (track.completionPercentage || 0), 0) / courseLessonTracks.length)
          : 0;
        
        const unit = {
          unitId: course.courseId,
          unitTitle: course.title || 'Course Unit',
          progress: courseProgress,
          contents: {
            type: 'nested',
            values: courseContents
          }
        };
        
        units.push(unit);
      }
      
      // Calculate overall course progress
      const courseProgress = units.length > 0 
        ? Math.round(units.reduce((sum, unit) => sum + (unit.progress || 0), 0) / units.length)
        : 0;
      
      const courseData = {
        courseId: course.courseId,
        courseTitle: course.title || 'Unknown Course',
        progress: courseProgress,
        units: {
          type: 'nested',
          values: units
        }
      };
      
      courseValues.push(courseData);
    }
    
    return {
      type: 'nested',
      values: courseValues
    };
  }

  /**
   * Ensure course structure exists in Elasticsearch document
   */
  private async ensureCourseStructureExists(
    userId: string,
    cohortId: string,
    courseId: string,
    contentData: any
  ): Promise<void> {
    try {
      this.logger.log(`Ensuring course structure exists for userId: ${userId}, cohortId: ${cohortId}, courseId: ${courseId}`);

      // Get current document
      const currentDoc = await this.client.get({
        index: this.indexName,
        id: userId
      });

      const userData = currentDoc._source as any;
      let structureUpdated = false;

      // Check if applications exist
      if (!userData.applications || !Array.isArray(userData.applications)) {
        this.logger.warn(`No applications found for userId: ${userId}`);
        return;
      }

      // Find application by cohortId
      const application = userData.applications.find((app: any) => app.cohortId === cohortId);
      if (!application) {
        this.logger.warn(`No application found for cohortId: ${cohortId}`);
        return;
      }

      // Ensure courses array exists
      if (!application.courses || !application.courses.values || !Array.isArray(application.courses.values)) {
        application.courses = {
          type: 'nested',
          values: []
        };
        structureUpdated = true;
      }

      // Check if course exists
      const existingCourse = application.courses.values.find((course: any) => course.courseId === courseId);
      if (!existingCourse) {
        // Create new course structure
        const newCourse = {
          courseId: courseId,
          courseTitle: contentData.title || 'Unknown Course',
          progress: contentData.tracking?.percentComplete || 0,
          units: {
            type: 'nested',
            values: [{
              unitId: courseId,
              unitTitle: contentData.title || 'Course Unit',
              progress: contentData.tracking?.percentComplete || 0,
              contents: {
                type: 'nested',
                values: []
              }
            }]
          }
        };
        application.courses.values.push(newCourse);
        structureUpdated = true;
      } else {
        // Check if units exist
        if (!existingCourse.units || !existingCourse.units.values || !Array.isArray(existingCourse.units.values)) {
          existingCourse.units = {
            type: 'nested',
            values: []
          };
          structureUpdated = true;
        }

        // Check if unit exists
        const existingUnit = existingCourse.units.values.find((unit: any) => unit.unitId === courseId);
        if (!existingUnit) {
          // Create new unit
          const newUnit = {
            unitId: courseId,
            unitTitle: contentData.title || 'Course Unit',
            progress: contentData.tracking?.percentComplete || 0,
            contents: {
              type: 'nested',
              values: []
            }
          };
          existingCourse.units.values.push(newUnit);
          structureUpdated = true;
        } else {
          // Check if contents array exists
          if (!existingUnit.contents || !existingUnit.contents.values || !Array.isArray(existingUnit.contents.values)) {
            existingUnit.contents = {
              type: 'nested',
              values: []
            };
            structureUpdated = true;
          }
        }
      }

      // Update document if structure was modified
      if (structureUpdated) {
        await this.client.update({
          index: this.indexName,
          id: userId,
          body: {
            doc: {
              applications: userData.applications
            }
          }
        });
        this.logger.log(`Course structure created/updated for userId: ${userId}, courseId: ${courseId}`);
      }
    } catch (error) {
      this.logger.error(`Error ensuring course structure exists for userId: ${userId}, courseId: ${courseId}:`, error);
      // Don't throw error to avoid breaking the main flow
    }
  }

  /**
   * Clean up duplicate lessonTrackId entries in a document
   */
  private cleanupDuplicateLessonTrackIds(document: any): void {
    if (!document.applications) return;

    this.logger.log('Starting cleanup of duplicate lessonTrackIds');

    for (const application of document.applications) {
      if (!application.courses?.values) continue;

      for (const course of application.courses.values) {
        if (!course.units?.values) continue;

        this.logger.log(`Processing course ${course.courseId} with ${course.units.values.length} units`);

        // Track unique lessons across all units to prevent duplicates
        const uniqueLessons = new Map();
        const lessonTrackIdMap = new Map();

        // First pass: identify all unique lessons and their lessonTrackIds
        course.units.values.forEach((unit: any) => {
          if (!unit.contents?.values) return;

          unit.contents.values.forEach((content: any) => {
            const key = content.lessonTrackId || content.contentId || content.lessonId;
            if (key) {
              if (!uniqueLessons.has(key)) {
                uniqueLessons.set(key, {
                  content,
                  unitId: unit.unitId,
                  unitTitle: unit.unitTitle
                });
                if (content.lessonTrackId) {
                  lessonTrackIdMap.set(content.lessonTrackId, key);
                }
              } else {
                // Found duplicate, mark for removal
                this.logger.warn(`Found duplicate content for key: ${key}`);
                content._markForRemoval = true;
              }
            }
          });
        });

        // Second pass: remove duplicates and fix unit structure
        course.units.values = course.units.values.filter((unit: any) => {
          if (!unit.contents?.values) return true;

          // Remove duplicate contents
          unit.contents.values = unit.contents.values.filter((content: any) => {
            if (content._markForRemoval) {
              this.logger.log(`Removing duplicate content: ${content.contentId || content.lessonId}`);
              return false;
            }
            return true;
          });

          // Remove units that have the same ID as content items (incorrect structure)
          if (unit.unitId && unit.contents.values.length > 0) {
            const firstContent = unit.contents.values[0];
            if (unit.unitId === firstContent.contentId || unit.unitId === firstContent.lessonId) {
              this.logger.warn(`Removing unit with incorrect ID: ${unit.unitId} (same as content ID)`);
              return false;
            }
          }

          // Remove empty units
          return unit.contents.values.length > 0;
        });

        this.logger.log(`After cleanup: ${course.units.values.length} units remaining`);
      }
    }
  }

  /**
   * Comprehensive user sync - similar to user-service implementation
   * This method ensures user data exists in Elasticsearch before updating specific sections
   * @param userId The user ID to sync
   * @param tenantId The tenant ID
   * @param organisationId The organization ID
   * @returns Promise<any> Complete user data or null if user not found
   */
  async comprehensiveUserSync(userId: string, tenantId: string, organisationId: string): Promise<any> {
    try {
      this.logger.log(`Starting comprehensive sync for userId: ${userId}`);

      // Check if user exists in Elasticsearch
      const existingUser = await this.getUserFromElasticsearch(userId);
      
      if (existingUser) {
        this.logger.log(`User ${userId} already exists in Elasticsearch, returning existing data`);
        return existingUser;
      }

      // If user doesn't exist, sync from database
      this.logger.log(`User ${userId} not found in Elasticsearch, syncing from database`);
      
      // Use existing sync method
      await this.syncAllUserCourses(userId);
      
      // Get the synced data
      const userData = await this.getUserFromElasticsearch(userId);
      
      this.logger.log(`Comprehensive sync completed for userId: ${userId}`);
      return userData;
    } catch (error) {
      this.logger.error(`Failed to perform comprehensive sync for userId: ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get user from Elasticsearch
   * @param userId The user ID
   * @returns Promise<any> User data or null
   */
  private async getUserFromElasticsearch(userId: string): Promise<any> {
    try {
      const response = await this.client.search({
        index: this.indexName,
        body: {
          query: {
            term: {
              userId: userId
            }
          }
        }
      });

      if (response.hits?.total && typeof response.hits.total === 'object' && 'value' in response.hits.total) {
        if (response.hits.total.value > 0) {
          return response.hits.hits[0]._source;
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`Failed to get user from Elasticsearch for userId: ${userId}:`, error);
      return null;
    }
  }

  /**
   * Handle enrollment API success - fetch and update complete user data in Elasticsearch
   * @param userId The user ID
   * @param courseId The course ID
   * @param tenantId The tenant ID
   * @param organisationId The organization ID
   * @param authorization Optional authorization header
   */
  async handleEnrollmentSuccess(
    userId: string,
    courseId: string,
    tenantId: string,
    organisationId: string,
    authorization?: string
  ): Promise<void> {
    try {
      this.logger.log(`Handling enrollment success for userId: ${userId}, courseId: ${courseId}`);

      // 1. Check if user exists in Elasticsearch
      const existingUser = await this.getUserFromElasticsearch(userId);
      
      if (existingUser) {
        this.logger.log(`User ${userId} exists in Elasticsearch, updating with new course data`);
        await this.updateUserWithEnrollmentData(userId, courseId, tenantId, organisationId, authorization);
      } else {
        this.logger.log(`User ${userId} not found in Elasticsearch, creating complete user structure`);
        await this.createCompleteUserStructure(userId, courseId, tenantId, organisationId, authorization);
      }

      this.logger.log(`Successfully handled enrollment for userId: ${userId}, courseId: ${courseId}`);
    } catch (error) {
      this.logger.error(`Failed to handle enrollment success for userId: ${userId}, courseId: ${courseId}:`, error);
      throw error;
    }
  }

  /**
   * Update existing user with new enrollment data
   * @param userId The user ID
   * @param courseId The course ID
   * @param tenantId The tenant ID
   * @param organisationId The organization ID
   * @param authorization Optional authorization header
   */
  private async updateUserWithEnrollmentData(
    userId: string,
    courseId: string,
    tenantId: string,
    organisationId: string,
    authorization?: string
  ): Promise<void> {
    try {
      // 1. Fetch complete course hierarchy with tracking
      const courseHierarchy = await this.fetchCourseHierarchyWithTracking(courseId, userId, tenantId, organisationId);
      
      if (!courseHierarchy) {
        this.logger.warn(`Course hierarchy not found for courseId: ${courseId}`);
        return;
      }

      // 2. Fetch user profile from user-microservice
      const userProfile = await this.fetchUserProfile(userId, authorization);

      // 3. Fetch assessment data for this user
      const assessmentData = await this.fetchUserAssessmentData(userId, tenantId, organisationId, authorization);

      // 4. Build complete user structure
      const userData = this.buildCompleteUserStructure(
        userId,
        userProfile,
        courseHierarchy,
        assessmentData,
        tenantId,
        organisationId
      );

      // 5. Update Elasticsearch
      await this.client.update({
        index: this.indexName,
        id: userId,
        body: {
          doc: userData,
          doc_as_upsert: true
        }
      });

      this.logger.log(`Successfully updated user ${userId} with enrollment data`);
    } catch (error) {
      this.logger.error(`Failed to update user with enrollment data for userId: ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Create complete user structure for new enrollment
   * @param userId The user ID
   * @param courseId The course ID
   * @param tenantId The tenant ID
   * @param organisationId The organization ID
   * @param authorization Optional authorization header
   */
  private async createCompleteUserStructure(
    userId: string,
    courseId: string,
    tenantId: string,
    organisationId: string,
    authorization?: string
  ): Promise<void> {
    try {
      // 1. Fetch complete course hierarchy with tracking
      const courseHierarchy = await this.fetchCourseHierarchyWithTracking(courseId, userId, tenantId, organisationId);
      
      if (!courseHierarchy) {
        this.logger.warn(`Course hierarchy not found for courseId: ${courseId}`);
        return;
      }

      // 2. Fetch user profile from user-microservice
      const userProfile = await this.fetchUserProfile(userId, authorization);

      // 3. Fetch assessment data for this user
      const assessmentData = await this.fetchUserAssessmentData(userId, tenantId, organisationId, authorization);

      // 4. Build complete user structure
      const userData = this.buildCompleteUserStructure(
        userId,
        userProfile,
        courseHierarchy,
        assessmentData,
        tenantId,
        organisationId
      );

      // 5. Save to Elasticsearch
      await this.client.index({
        index: this.indexName,
        id: userId,
        body: userData
      });

      this.logger.log(`Successfully created complete user structure for userId: ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to create complete user structure for userId: ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Handle tracking progress update - fetch and update complete user data in Elasticsearch
   * @param userId The user ID
   * @param lessonId The lesson ID
   * @param attemptId The attempt ID
   * @param tenantId The tenant ID
   * @param organisationId The organization ID
   * @param authorization Optional authorization header
   */
  async handleTrackingProgressUpdate(
    userId: string,
    lessonId: string,
    attemptId: string,
    tenantId: string,
    organisationId: string,
    authorization?: string
  ): Promise<void> {
    try {
      this.logger.log(`🔄 Handling tracking progress update for userId: ${userId}, lessonId: ${lessonId}, attemptId: ${attemptId}`);

      // 1. Check if user exists in Elasticsearch
      this.logger.log(`🔍 Checking if user ${userId} exists in Elasticsearch...`);
      const existingUser = await this.getUserFromElasticsearch(userId);
      
      if (!existingUser) {
        this.logger.warn(`❌ User ${userId} not found in Elasticsearch, skipping tracking update`);
        return;
      }
      this.logger.log(`✅ User found in Elasticsearch`);

      // 2. Get updated tracking data from database
      this.logger.log(`🔍 Fetching lesson track ${attemptId} from database...`);
      const lessonTrack = await this.lessonTrackRepository.findOne({
        where: { lessonTrackId: attemptId, userId, tenantId, organisationId }
      });

      if (!lessonTrack) {
        this.logger.warn(`❌ Lesson track ${attemptId} not found in database`);
        return;
      }
      this.logger.log(`✅ Lesson track found: courseId=${lessonTrack.courseId}, status=${lessonTrack.status}, completion=${lessonTrack.completionPercentage}%`);

      // 3. Transform tracking data with proper answer structure
      this.logger.log(`🔄 Transforming tracking data...`);
      const transformedTracking = this.transformTrackingData({
        score: lessonTrack.score,
        timeSpent: lessonTrack.timeSpent,
        progress: lessonTrack.completionPercentage,
        lastAccessed: lessonTrack.updatedAt,
        attempt: lessonTrack.attempt,
        status: lessonTrack.status,
        params: lessonTrack.params
      });
      this.logger.log(`✅ Transformed tracking data:`, transformedTracking);

      // 4. Update the specific lesson tracking in the user's course structure
      this.logger.log(`🔍 Looking for lesson ${lessonId} in course structure...`);
      const updatedUser = { ...existingUser };
      
      let lessonFound = false;
      
      // Check if courses exist in applications
      if (updatedUser.applications && Array.isArray(updatedUser.applications)) {
        this.logger.log(`📋 Found ${updatedUser.applications.length} applications`);
        for (const application of updatedUser.applications) {
          if (application.courses && application.courses.values) {
            this.logger.log(`📚 Found ${application.courses.values.length} courses in application`);
            for (const course of application.courses.values) {
              this.logger.log(`🔍 Checking course: ${course.courseId}`);
          if (course.courseId === lessonTrack.courseId) {
                this.logger.log(`✅ Found matching course: ${course.courseId}`);
            if (course.units && course.units.values) {
                  this.logger.log(`📖 Found ${course.units.values.length} units in course`);
              for (const unit of course.units.values) {
                if (unit.contents && unit.contents.values) {
                      this.logger.log(`📝 Found ${unit.contents.values.length} contents in unit`);
                  for (const content of unit.contents.values) {
                        this.logger.log(`🔍 Checking content: lessonId=${content.lessonId}, contentId=${content.contentId}`);
                    if (content.lessonId === lessonId) {
                          this.logger.log(`✅ Found matching lesson: ${lessonId}`);
                      // Update the tracking data with transformed structure
                          const oldTracking = content.tracking;
                      content.tracking = {
                        ...content.tracking,
                        ...transformedTracking
                      };
                          this.logger.log(`📊 Updated tracking for lesson ${lessonId}:`, {
                            old: oldTracking,
                            new: content.tracking
                          });
                          lessonFound = true;
                      break;
                    }
                  }
                      if (lessonFound) break;
                    }
                  }
                  if (lessonFound) break;
                }
              }
            }
            if (lessonFound) break;
          }
        }
      }

      if (!lessonFound) {
        this.logger.warn(`❌ Lesson ${lessonId} not found in user's course structure`);
        this.logger.log(`🔍 Debug: Available lesson IDs in course structure:`);
        if (updatedUser.applications && Array.isArray(updatedUser.applications)) {
          for (const application of updatedUser.applications) {
            if (application.courses && application.courses.values) {
              for (const course of application.courses.values) {
                if (course.courseId === lessonTrack.courseId) {
                  this.logger.log(`📚 Course ${course.courseId} structure:`);
                  if (course.units && course.units.values) {
                    for (const unit of course.units.values) {
                      this.logger.log(`📖 Unit ${unit.unitId || 'unknown'}:`);
                      if (unit.contents && unit.contents.values) {
                        for (const content of unit.contents.values) {
                          this.logger.log(`📝 Content: lessonId=${content.lessonId}, contentId=${content.contentId}, title=${content.title || 'unknown'}`);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        return;
      }

      // 5. Update user data in Elasticsearch
      this.logger.log(`💾 Updating user document in Elasticsearch...`);
      await this.client.update({
        index: this.indexName,
        id: userId,
        body: {
          doc: updatedUser
        }
      });
      
      this.logger.log(`✅ Successfully updated tracking progress for user ${userId}, lesson ${lessonId}`);
    } catch (error) {
      this.logger.error(`❌ Failed to handle tracking progress update for user ${userId}, lesson ${lessonId}:`, error);
      throw error;
    }
  }

  /**
   * Update existing user with tracking data
   * @param userId The user ID
   * @param lessonId The lesson ID
   * @param attemptId The attempt ID
   * @param tenantId The tenant ID
   * @param organisationId The organization ID
   * @param authorization Optional authorization header
   */
  private async updateUserWithTrackingData(
    userId: string,
    lessonId: string,
    attemptId: string,
    tenantId: string,
    organisationId: string,
    authorization?: string
  ): Promise<void> {
    try {
      // 1. Get lesson tracking data
      const lessonTrack = await this.lessonTrackRepository.findOne({
        where: { lessonTrackId: attemptId, userId, tenantId, organisationId },
        relations: ['lesson', 'lesson.module']
      });

      if (!lessonTrack) {
        this.logger.warn(`Lesson track not found for attemptId: ${attemptId}`);
        return;
      }

      const courseId = lessonTrack.lesson?.module?.courseId;
      if (!courseId) {
        this.logger.warn(`Course ID not found for lessonId: ${lessonId}`);
        return;
      }

      // 2. Fetch complete course hierarchy with tracking
      const courseHierarchy = await this.fetchCourseHierarchyWithTracking(courseId, userId, tenantId, organisationId);
      
      if (!courseHierarchy) {
        this.logger.warn(`Course hierarchy not found for courseId: ${courseId}`);
        return;
      }

      // 3. Fetch user profile from user-microservice
      const userProfile = await this.fetchUserProfile(userId, authorization);

      // 4. Fetch assessment data for this user
      const assessmentData = await this.fetchUserAssessmentData(userId, tenantId, organisationId, authorization);

      // 5. Build complete user structure
      const userData = this.buildCompleteUserStructure(
        userId,
        userProfile,
        courseHierarchy,
        assessmentData,
        tenantId,
        organisationId
      );

      // 6. Update specific lesson tracking in the structure
      this.updateLessonTrackingInStructure(userData, lessonTrack);

      // 7. Update Elasticsearch
      await this.client.update({
        index: this.indexName,
        id: userId,
        body: {
          doc: userData,
          doc_as_upsert: true
        }
      });

      this.logger.log(`Successfully updated user ${userId} with tracking data for lessonId: ${lessonId}`);
    } catch (error) {
      this.logger.error(`Failed to update user with tracking data for userId: ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Create complete user structure for tracking update
   * @param userId The user ID
   * @param lessonId The lesson ID
   * @param attemptId The attempt ID
   * @param tenantId The tenant ID
   * @param organisationId The organization ID
   * @param authorization Optional authorization header
   */
  private async createCompleteUserStructureWithTracking(
    userId: string,
    lessonId: string,
    attemptId: string,
    tenantId: string,
    organisationId: string,
    authorization?: string
  ): Promise<void> {
    try {
      // 1. Get lesson tracking data to find courseId
      const lessonTrack = await this.lessonTrackRepository.findOne({
        where: { lessonTrackId: attemptId, userId, tenantId, organisationId },
        relations: ['lesson', 'lesson.module']
      });

      if (!lessonTrack) {
        this.logger.warn(`Lesson track not found for attemptId: ${attemptId}`);
        return;
      }

      const courseId = lessonTrack.lesson?.module?.courseId;
      if (!courseId) {
        this.logger.warn(`Course ID not found for lessonId: ${lessonId}`);
        return;
      }

      // 2. Fetch complete course hierarchy with tracking
      const courseHierarchy = await this.fetchCourseHierarchyWithTracking(courseId, userId, tenantId, organisationId);
      
      if (!courseHierarchy) {
        this.logger.warn(`Course hierarchy not found for courseId: ${courseId}`);
        return;
      }

      // 3. Fetch user profile from user-microservice
      const userProfile = await this.fetchUserProfile(userId, authorization);

      // 4. Fetch assessment data for this user
      const assessmentData = await this.fetchUserAssessmentData(userId, tenantId, organisationId, authorization);

      // 5. Build complete user structure
      const userData = this.buildCompleteUserStructure(
        userId,
        userProfile,
        courseHierarchy,
        assessmentData,
        tenantId,
        organisationId
      );

      // 6. Update specific lesson tracking in the structure
      this.updateLessonTrackingInStructure(userData, lessonTrack);

      // 7. Save to Elasticsearch
      await this.client.index({
        index: this.indexName,
        id: userId,
        body: userData
      });

      this.logger.log(`Successfully created complete user structure with tracking for userId: ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to create complete user structure with tracking for userId: ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Update lesson tracking in the user structure
   * @param userData The user data structure
   * @param lessonTrack The lesson tracking data
   */
  private updateLessonTrackingInStructure(userData: any, lessonTrack: any): void {
    try {
      this.logger.log(`=== STARTING UPDATE LESSON TRACKING IN STRUCTURE ===`);
      this.logger.log(`Target lessonId: ${lessonTrack.lessonId}`);
      this.logger.log(`Target status: ${lessonTrack.status}`);
      this.logger.log(`Target courseId: ${lessonTrack.courseId}`);
      
      // Find the specific lesson in the user structure and update its tracking
      if (userData.applications && userData.applications.length > 0) {
        this.logger.log(`Found ${userData.applications.length} applications`);
        
        for (const application of userData.applications) {
          this.logger.log(`Processing application with cohortId: ${application.cohortId}`);
          
          if (application.courses && application.courses.values && application.courses.values.length > 0) {
            this.logger.log(`Found ${application.courses.values.length} courses in application`);
            
            for (const course of application.courses.values) {
              this.logger.log(`Processing course: ${course.courseId} - ${course.courseTitle}`);
              
              if (course.units && course.units.values && course.units.values.length > 0) {
                this.logger.log(`Found ${course.units.values.length} units in course`);
                
                for (const unit of course.units.values) {
                  this.logger.log(`Processing unit: ${unit.unitId} - ${unit.unitTitle}`);
                  
                  if (unit.contents && unit.contents.values && unit.contents.values.length > 0) {
                    this.logger.log(`Found ${unit.contents.values.length} contents in unit`);
                    
                    for (const content of unit.contents.values) {
                      this.logger.log(`Checking content: ${content.contentId} vs lessonId: ${lessonTrack.lessonId}`);
                      
                      if (content.lessonId === lessonTrack.lessonId) {
                        // Update the specific lesson tracking
                        const oldStatus = content.status;
                        const oldTrackingStatus = content.tracking?.status;
                        
                        this.logger.log(`🎯 FOUND MATCHING LESSON!`);
                        this.logger.log(`  - ContentId: ${content.contentId}`);
                        this.logger.log(`  - LessonId: ${content.lessonId}`);
                        this.logger.log(`  - Old Status: ${oldStatus}`);
                        this.logger.log(`  - Old Tracking Status: ${oldTrackingStatus}`);
                        
                        content.tracking = {
                          score: lessonTrack.score,
                          timeSpent: lessonTrack.timeSpent || 0,
                          progress: lessonTrack.completionPercentage || 0,
                          lastAccessed: lessonTrack.updatedAt,
                          attempt: lessonTrack.attempt,
                          status: lessonTrack.status || 'in_progress'
                        };
                        content.status = lessonTrack.status || 'in_progress';
                        
                        this.logger.log(`✅ UPDATED LESSON TRACKING:`);
                        this.logger.log(`  - New Status: ${content.status}`);
                        this.logger.log(`  - New Tracking Status: ${content.tracking.status}`);
                        this.logger.log(`  - Progress: ${content.tracking.progress}`);
                        this.logger.log(`  - Attempt: ${content.tracking.attempt}`);
                        this.logger.log(`  - Last Accessed: ${content.tracking.lastAccessed}`);
                        this.logger.log(`=== COMPLETED UPDATE LESSON TRACKING IN STRUCTURE ===`);
                        return;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      
      this.logger.warn(`❌ Lesson with lessonId: ${lessonTrack.lessonId} not found in user structure`);
      this.logger.warn(`Available lessons: ${this.getAllLessonIds(userData).join(', ')}`);
      this.logger.log(`=== FAILED UPDATE LESSON TRACKING IN STRUCTURE ===`);
    } catch (error) {
      this.logger.error(`❌ Failed to update lesson tracking in structure:`, error);
      this.logger.log(`=== FAILED UPDATE LESSON TRACKING IN STRUCTURE ===`);
    }
  }

  /**
   * Helper method to get all lesson IDs from user structure for debugging
   */
  private getAllLessonIds(userData: any): string[] {
    const lessonIds: string[] = [];
    try {
      if (userData.applications && userData.applications.length > 0) {
        for (const application of userData.applications) {
          if (application.courses && application.courses.values && application.courses.values.length > 0) {
            for (const course of application.courses.values) {
              if (course.units && course.units.values && course.units.values.length > 0) {
                for (const unit of course.units.values) {
                  if (unit.contents && unit.contents.values && unit.contents.values.length > 0) {
                    for (const content of unit.contents.values) {
                      if (content.lessonId) {
                        lessonIds.push(content.lessonId);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error getting lesson IDs:`, error);
    }
    return lessonIds;
  }

  /**
   * Helper method to check if lesson exists in course structure and log course details
   */
  private checkLessonInCourseStructure(userData: any, lessonId: string): void {
    try {
      this.logger.log(`Checking if lesson ${lessonId} exists in course structure`);
      
      if (userData.applications && userData.applications.length > 0) {
        for (const application of userData.applications) {
          this.logger.log(`Application cohortId: ${application.cohortId}`);
          
          if (application.courses && application.courses.values && application.courses.values.length > 0) {
            for (const course of application.courses.values) {
              this.logger.log(`Course: ${course.courseId} - ${course.courseTitle}`);
              
              if (course.units && course.units.values && course.units.values.length > 0) {
                for (const unit of course.units.values) {
                  this.logger.log(`Unit: ${unit.unitId} - ${unit.unitTitle}`);
                  
                  if (unit.contents && unit.contents.values && unit.contents.values.length > 0) {
                    for (const content of unit.contents.values) {
                      this.logger.log(`Content: ${content.contentId} - Lesson: ${content.lessonId} - Status: ${content.status}`);
                      
                      if (content.lessonId === lessonId) {
                        this.logger.log(`✅ Found lesson ${lessonId} in course structure!`);
                        this.logger.log(`Current status: ${content.status}, tracking status: ${content.tracking?.status}`);
                        return;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      
      this.logger.warn(`❌ Lesson ${lessonId} not found in course structure`);
    } catch (error) {
      this.logger.error(`Error checking lesson in course structure:`, error);
    }
  }

  /**
   * Fetch course hierarchy with existing tracking data from database
   * @param courseId The course ID
   * @param userId The user ID
   * @param tenantId The tenant ID
   * @param organisationId The organization ID
   * @returns Course hierarchy with tracking data
   */
  private async fetchCourseHierarchyWithTracking(
    courseId: string,
    userId: string,
    tenantId: string,
    organisationId: string
  ): Promise<any> {
    try {
      this.logger.log(`Fetching course hierarchy with tracking for courseId: ${courseId}, userId: ${userId}`);

      // 1. Fetch course details
      const course = await this.courseRepository.findOne({
        where: { courseId, tenantId, organisationId },
        relations: ['modules', 'modules.lessons']
      });

      if (!course) {
        this.logger.warn(`Course not found: ${courseId}`);
        return null;
      }

      // 2. Fetch all lesson tracking data for this user and course
      const lessonTracks = await this.lessonTrackRepository.find({
        where: { 
          courseId, 
          userId, 
          tenantId, 
          organisationId 
        },
        order: { updatedAt: 'DESC' }
      });

      // 3. Create a map of lesson tracking data for quick lookup
      const lessonTrackingMap = new Map();
      lessonTracks.forEach(track => {
        lessonTrackingMap.set(track.lessonId, track);
      });

      this.logger.log(`Found ${lessonTracks.length} lesson tracking records for user ${userId}`);

      // 4. Build course hierarchy with tracking data
      const courseHierarchy: any = {
        courseId: course.courseId,
        name: course.title,
        description: course.description,
        status: course.status,
        progress: 0,
        units: {
          values: [],
          type: 'nested'
        }
      };

      let totalProgress = 0;
      let completedUnits = 0;

      // 5. Process each module/unit
      for (const module of course.modules || []) {
        const unit: any = {
          unitId: module.moduleId,
          name: module.title,
          description: module.description,
          progress: 0,
          contents: {
            values: [],
            type: 'nested'
          }
        };

        let unitProgress = 0;
        let completedLessons = 0;

        // 6. Process each lesson in the module
        for (const lesson of module.lessons || []) {
          const lessonTrack = lessonTrackingMap.get(lesson.lessonId);
          
          // 7. Build lesson content with tracking data
          const content: any = {
            contentId: lesson.lessonId,
            lessonId: lesson.lessonId,
            type: lesson.format || 'text_and_media',
            status: lessonTrack?.status || 'not_started',
            tracking: {
              score: lessonTrack?.score || null,
              timeSpent: lessonTrack?.timeSpent || 0,
              progress: lessonTrack?.completionPercentage || 0,
              lastAccessed: lessonTrack?.updatedAt || null,
              attempt: lessonTrack?.attempt || 1,
              status: lessonTrack?.status || 'not_started'
            }
          };

          // 8. Add additional tracking metadata
          if (lessonTrack?.params) {
            try {
              const params = typeof lessonTrack.params === 'string' 
                ? JSON.parse(lessonTrack.params) 
                : lessonTrack.params;
              
              content.tracking = {
                ...content.tracking,
                ...params
              };
            } catch (error) {
              this.logger.warn(`Failed to parse lesson track params for lessonId: ${lesson.lessonId}`);
            }
          }

          unit.contents.values.push(content);

          // 9. Calculate unit progress
          if (lessonTrack?.status === 'completed') {
            completedLessons++;
            unitProgress += lessonTrack.completionPercentage || 0;
          } else if (lessonTrack?.status === 'in_progress') {
            unitProgress += lessonTrack.completionPercentage || 0;
          }
        }

        // 10. Calculate unit progress percentage
        if (unit.contents.values.length > 0) {
          unit.progress = Math.round(unitProgress / unit.contents.values.length);
          if (completedLessons === unit.contents.values.length) {
            completedUnits++;
          }
        }

        courseHierarchy.units.values.push(unit);
        totalProgress += unit.progress;
      }

      // 11. Calculate overall course progress
      if (courseHierarchy.units.values.length > 0) {
        courseHierarchy.progress = Math.round(totalProgress / courseHierarchy.units.values.length);
      }

      this.logger.log(`Built course hierarchy with tracking for courseId: ${courseId}, progress: ${courseHierarchy.progress}%`);

      return courseHierarchy;
    } catch (error) {
      this.logger.error(`Failed to fetch course hierarchy with tracking for courseId: ${courseId}:`, error);
      return null;
    }
  }

  /**
   * Fetch user profile from user-microservice
   * @param userId The user ID
   * @param authorization Optional authorization header
   * @returns Promise<any> User profile or default profile
   */
  private async fetchUserProfile(userId: string, authorization?: string): Promise<any> {
    try {
      const headers: any = {};
      
      // Add authorization header if provided
      if (authorization) {
        headers.Authorization = authorization;
      }

      // Add required headers for user-microservice
      headers['Content-Type'] = 'application/json';
      headers['tenantId'] = process.env.TENANT_ID || 'ef99949b-7f3a-4a5f-806a-e67e683e38f3';
      headers['organisationId'] = process.env.ORGANISATION_ID || 'd36d9079-0f42-4ba3-be03-26c9e79509ee';
      headers['userId'] = userId;

      this.logger.log(`Fetching user profile for userId: ${userId} from user-microservice`);

      // Use the new profile-applications endpoint to fetch user profile and applications data
      const response = await this.httpService.axiosRef.get(
        `${this.userMicroserviceUrl}/user/v1/elasticsearch/users/${userId}/profile-applications`,
        { headers }
      );

      // The profile-applications endpoint returns the complete user data structure
      if (response.data && response.data.status === 'success' && response.data.data) {
        const userData = response.data.data;
        
        // Check if profile data is properly populated
        if (userData.profile && (userData.profile.firstName || userData.profile.lastName || userData.profile.email)) {
        this.logger.log(`Successfully fetched user profile and applications for userId: ${userId}`);
          return userData;
        } else {
          this.logger.warn(`User profile data is empty for userId: ${userId}, trying sync endpoint`);
        }
      }

      // If profile-applications doesn't return data or has empty profile, try the sync endpoint as fallback
      this.logger.log(`Trying sync endpoint for userId: ${userId}`);
      const syncResponse = await this.httpService.axiosRef.post(
        `${this.userMicroserviceUrl}/user/v1/elasticsearch/users/${userId}/sync`,
        {}, // Empty body for sync
        { headers }
      );

      if (syncResponse.data && syncResponse.data.result && syncResponse.data.result.data) {
        const userData = syncResponse.data.result.data;
        
        // Check if profile data is properly populated
        if (userData.profile && (userData.profile.firstName || userData.profile.lastName || userData.profile.email)) {
          this.logger.log(`Successfully fetched user profile via sync for userId: ${userId}`);
          return userData;
        } else {
          this.logger.warn(`User profile data is still empty for userId: ${userId}, trying read endpoint`);
        }
      }

      // If sync doesn't return data or has empty profile, try the read endpoint as final fallback
      this.logger.log(`Trying read endpoint for userId: ${userId}`);
      const readResponse = await this.httpService.axiosRef.get(
        `${this.userMicroserviceUrl}/user/v1/read/${userId}`,
        { headers }
      );

      const userData = readResponse.data?.result?.data;
      if (userData && userData.profile && (userData.profile.firstName || userData.profile.lastName || userData.profile.email)) {
        this.logger.log(`Successfully fetched user profile via read for userId: ${userId}`);
        return userData;
      }

      // If all endpoints fail or return empty profile, use default profile
      this.logger.warn(`All user-microservice endpoints failed or returned empty profile for userId: ${userId}, using default profile`);
      return this.getDefaultUserProfile(userId);
    } catch (error) {
      this.logger.warn(`Failed to fetch user profile for userId: ${userId}, using default profile:`, error.message);
      return this.getDefaultUserProfile(userId);
    }
  }

  /**
   * Get default user profile
   * @param userId The user ID
   * @returns Default user profile
   */
  private getDefaultUserProfile(userId: string): any {
    this.logger.warn(`Creating default user profile for userId: ${userId}`);
    
    return {
      userId: userId,
      profile: {
      userId: userId,
      username: `user-${userId}`,
      firstName: 'User',
      lastName: 'Name',
        middleName: '',
      email: `user-${userId}@example.com`,
        mobile: '',
        mobile_country_code: '',
        gender: '',
        dob: null,
        country: '',
        address: '',
        district: '',
        state: '',
        pincode: '',
        status: 'active',
        customFields: []
      },
      applications: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Fetch user assessment data
   * @param userId The user ID
   * @param tenantId The tenant ID
   * @param organisationId The organization ID
   * @param authorization Optional authorization header
   * @returns Promise<any[]> Assessment data array
   */
  private async fetchUserAssessmentData(
    userId: string,
    tenantId: string,
    organisationId: string,
    authorization?: string
  ): Promise<any[]> {
    try {
      const headers: any = {};
      if (authorization) {
        headers.Authorization = authorization;
      }

      const response = await this.httpService.axiosRef.get(
        `${process.env.ASSESSMENT_SERVICE_URL || 'http://localhost:6000'}/assessment/v1/attempts/user/${userId}`,
        { headers }
      );

      return response.data?.result?.data || [];
    } catch (error) {
      this.logger.warn(`Failed to fetch assessment data for userId: ${userId}:`, error.message);
      return [];
    }
  }

  /**
   * Build complete user structure
   * @param userId The user ID
   * @param userProfile The user profile
   * @param courseHierarchy The course hierarchy
   * @param assessmentData The assessment data
   * @param tenantId The tenant ID
   * @param organisationId The organization ID
   * @returns Complete user structure
   */
  private buildCompleteUserStructure(
    userId: string,
    userProfile: any,
    courseHierarchy: any,
    assessmentData: any[],
    tenantId: string,
    organisationId: string
  ): any {
    // Build course structure from hierarchy
    const courseStructure = this.buildCourseStructureFromHierarchy(courseHierarchy, assessmentData);

    // Build application structure
    const application = {
      cohortId: courseHierarchy.courseId,
      formId: '',
      submissionId: '',
      cohortmemberstatus: 'enrolled',
      formstatus: 'active',
      completionPercentage: courseHierarchy.tracking?.progress || 0,
      progress: {
        pages: {},
        overall: {
          total: 0,
          completed: 0
        }
      },
      lastSavedAt: new Date().toISOString(),
      submittedAt: null,
      cohortDetails: {
        cohortId: courseHierarchy.courseId,
        name: courseHierarchy.name || 'Course Cohort',
        type: 'COHORT',
        status: 'active',
      },
      courses: {
        type: 'nested',
        values: [courseStructure]
      }
    };

    // Build complete user structure
    const userData = {
      userId: userId,
      profile: userProfile,
      applications: [application],
      answers: assessmentData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return userData;
  }

  /**
   * Build course structure from hierarchy
   * @param courseHierarchy The course hierarchy
   * @param assessmentData The assessment data
   * @returns Course structure
   */
  private buildCourseStructureFromHierarchy(courseHierarchy: any, assessmentData: any[]): any {
    const units = courseHierarchy.modules?.map((module: any) => ({
      unitId: module.moduleId,
      unitTitle: module.name,
      progress: module.tracking?.progress || 0,
      contents: {
        type: 'nested',
        values: module.lessons?.map((lesson: any) => {
          // Find assessment data for this lesson
          const lessonAssessmentData = assessmentData.filter(assessment => 
            assessment.lessonId === lesson.lessonId
          );

          return {
            contentId: lesson.lessonId,
            lessonId: lesson.lessonId,
            type: lesson.format || 'video',
            title: lesson.name,
            status: lesson.tracking?.status || 'incomplete',
            tracking: lesson.tracking || {
              timeSpent: 0,
              currentPosition: 0,
              lastPosition: 0,
              percentComplete: 0
            },
            // Include assessment data if this is a test lesson
            ...(lesson.format === 'test' && lessonAssessmentData.length > 0 && {
              answers: lessonAssessmentData.map(assessment => ({
                testId: assessment.testId,
                attemptId: assessment.attemptId,
                answers: assessment.answers,
                score: assessment.score,
                status: assessment.status
              }))
            })
          };
        }) || []
      }
    })) || [];

    return {
      courseId: courseHierarchy.courseId,
      courseTitle: courseHierarchy.name,
      progress: courseHierarchy.tracking?.progress || 0,
      units: {
        type: 'nested',
        values: units
      }
    };
  }

  /**
   * Transform answer data to extract UUID and add text field
   * @param answerData The raw answer data from tracking
   * @returns Transformed answer data with extracted UUID and text
   */
  private transformAnswerData(answerData: any): any {
    if (!answerData || typeof answerData !== 'string') {
      return answerData;
    }

    // Extract UUID from "Selected options: uuid" format
    const selectedOptionsMatch = answerData.match(/Selected options: ([a-f0-9-]+)/);
    if (selectedOptionsMatch) {
      const extractedUuid = selectedOptionsMatch[1];
      return {
        id: extractedUuid,
        text: answerData // Keep original as text for reference
      };
    }

    // If it's already a UUID, return as is
    const uuidRegex = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
    if (uuidRegex.test(answerData)) {
      return {
        id: answerData,
        text: answerData // For now, use same as text, could be enhanced with lookup
      };
    }

    // If it's neither format, return original
    return {
      id: answerData,
      text: answerData
    };
  }

  /**
   * Transform tracking data to include proper answer structure
   * @param trackingData The raw tracking data
   * @returns Transformed tracking data with proper answer structure
   */
  private transformTrackingData(trackingData: any): any {
    if (!trackingData) {
      return trackingData;
    }

    const transformed = { ...trackingData };

    // Transform answers if they exist
    if (transformed.answers && transformed.answers.values) {
      transformed.answers.values = transformed.answers.values.map((answer: any) => ({
        ...answer,
        answer: this.transformAnswerData(answer.answer)
      }));
    }

    // Handle params if they contain answer data
    if (transformed.params) {
      try {
        const params = typeof transformed.params === 'string' 
          ? JSON.parse(transformed.params) 
          : transformed.params;
        
        if (params.answers && Array.isArray(params.answers)) {
          params.answers = params.answers.map((answer: any) => ({
            ...answer,
            answer: this.transformAnswerData(answer.answer)
          }));
        }
        
        transformed.params = params;
      } catch (error) {
        this.logger.warn('Failed to parse tracking params for answer transformation');
      }
    }

    return transformed;
  }

  /**
   * Handle lesson attempt data in Elasticsearch
   * Check if data exists, update if exists, fetch all user data if not
   * Ensures no extra users are added and maintains correct mapping in courses
   */
  async handleLessonAttemptData(
    attemptId: string,
    userId: string,
    tenantId: string,
    organisationId: string,
    authorization?: string
  ): Promise<void> {
    if (!isElasticsearchEnabled()) {
      this.logger.debug('Elasticsearch is disabled, skipping lesson attempt data handling');
      return;
    }

    try {
      this.logger.log(`=== STARTING LESSON ATTEMPT ELASTICSEARCH SYNC ===`);
      this.logger.log(`AttemptId: ${attemptId}`);
      this.logger.log(`UserId: ${userId}`);
      this.logger.log(`TenantId: ${tenantId}`);
      this.logger.log(`OrganisationId: ${organisationId}`);

      // Check if user document exists in Elasticsearch
      const userExists = await this.checkUserDocumentExists(userId);
      this.logger.log(`User exists in Elasticsearch: ${userExists}`);
      
      if (userExists) {
        // User exists, update the attempt data
        this.logger.log(`User ${userId} exists in Elasticsearch, updating attempt data`);
        await this.updateLessonAttemptInElasticsearch(attemptId, userId, tenantId, organisationId);
      } else {
        // User doesn't exist, fetch all user data and create complete structure
        this.logger.log(`User ${userId} doesn't exist in Elasticsearch, fetching all user data`);
        await this.createCompleteUserStructureWithAttempt(
          userId,
          attemptId,
          tenantId,
          organisationId,
          authorization
        );
      }

      this.logger.log(`=== SUCCESSFULLY COMPLETED LESSON ATTEMPT ELASTICSEARCH SYNC ===`);
      this.logger.log(`Successfully handled lesson attempt data for attemptId: ${attemptId}, userId: ${userId}`);

    } catch (error) {
      this.logger.error(`=== FAILED LESSON ATTEMPT ELASTICSEARCH SYNC ===`);
      this.logger.error(`Failed to handle lesson attempt data for attemptId: ${attemptId}, userId: ${userId}:`, error);
      // Don't throw error to avoid breaking the main flow
    }
  }

  /**
   * Update lesson attempt data in existing Elasticsearch document
   */
  private async updateLessonAttemptInElasticsearch(
    attemptId: string,
    userId: string,
    tenantId: string,
    organisationId: string
  ): Promise<void> {
    try {
      this.logger.log(`=== STARTING UPDATE LESSON ATTEMPT IN ELASTICSEARCH ===`);
      this.logger.log(`AttemptId: ${attemptId}`);
      this.logger.log(`UserId: ${userId}`);
      this.logger.log(`TenantId: ${tenantId}`);
      this.logger.log(`OrganisationId: ${organisationId}`);
      
      // Get the lesson track data from database
      this.logger.log(`Fetching lesson track from database...`);
      const lessonTrack = await this.lessonTrackRepository.findOne({
        where: {
          lessonTrackId: attemptId,
          userId,
          tenantId,
          organisationId,
        },
        relations: ['lesson', 'lesson.media'],
      });

      if (!lessonTrack) {
        this.logger.warn(`❌ Lesson track not found for attemptId: ${attemptId}`);
        return;
      }

      this.logger.log(`✅ Found lesson track in database:`);
      this.logger.log(`  - LessonId: ${lessonTrack.lessonId}`);
      this.logger.log(`  - Status: ${lessonTrack.status}`);
      this.logger.log(`  - CourseId: ${lessonTrack.courseId}`);
      this.logger.log(`  - Attempt: ${lessonTrack.attempt}`);
      this.logger.log(`  - UpdatedAt: ${lessonTrack.updatedAt}`);

      // Get current user document from Elasticsearch
      this.logger.log(`Fetching user document from Elasticsearch...`);
      const userDocument = await this.getUserFromElasticsearch(userId);
      if (!userDocument) {
        this.logger.warn(`❌ User document not found in Elasticsearch for userId: ${userId}`);
        return;
      }

      this.logger.log(`✅ Found user document in Elasticsearch for userId: ${userId}`);

      // Check if lesson exists in course structure before updating
      this.logger.log(`Checking if lesson exists in course structure...`);
      this.checkLessonInCourseStructure(userDocument, lessonTrack.lessonId);

      // Check if the lesson track's courseId matches any course in the user structure
      if (lessonTrack.courseId) {
        this.logger.log(`Checking if courseId matches in user structure...`);
        this.checkCourseIdMatch(userDocument, lessonTrack.courseId);
      } else {
        this.logger.warn(`Lesson track has no courseId for attemptId: ${attemptId}`);
      }

      // Update the lesson tracking data in the document
      this.logger.log(`Updating lesson tracking in user structure...`);
      this.updateLessonTrackingInStructure(userDocument, lessonTrack);

      // Update the document in Elasticsearch
      this.logger.log(`Updating document in Elasticsearch...`);
      await this.client.update({
        index: this.indexName,
        id: userId,
        body: {
          doc: userDocument,
          doc_as_upsert: true
        }
      });

      this.logger.log(`✅ Successfully updated lesson attempt data in Elasticsearch`);
      this.logger.log(`=== COMPLETED UPDATE LESSON ATTEMPT IN ELASTICSEARCH ===`);

    } catch (error) {
      this.logger.error(`❌ Failed to update lesson attempt in Elasticsearch:`);
      this.logger.error(`AttemptId: ${attemptId}, UserId: ${userId}`);
      this.logger.error(`Error:`, error);
      throw error;
    }
  }

  /**
   * Create complete user structure with attempt data
   */
  private async createCompleteUserStructureWithAttempt(
    userId: string,
    attemptId: string,
    tenantId: string,
    organisationId: string,
    authorization?: string
  ): Promise<void> {
    try {
      this.logger.log(`Creating complete user structure with attempt data for userId: ${userId}, attemptId: ${attemptId}`);

      // Get lesson track data
      const lessonTrack = await this.lessonTrackRepository.findOne({
        where: {
          lessonTrackId: attemptId,
          userId,
          tenantId,
          organisationId,
        },
        relations: ['lesson', 'lesson.media'],
      });

      if (!lessonTrack) {
        this.logger.warn(`Lesson track not found for attemptId: ${attemptId}`);
        return;
      }

      // Fetch user profile
      const userProfile = await this.fetchUserProfile(userId, authorization);

      // Fetch course hierarchy
      if (!lessonTrack.courseId) {
        this.logger.warn(`Lesson track has no courseId for attemptId: ${attemptId}`);
        return;
      }
      
      const courseHierarchy = await this.fetchCourseHierarchyWithTracking(
        lessonTrack.courseId,
        userId,
        tenantId,
        organisationId
      );

      // Fetch assessment data
      const assessmentData = await this.fetchUserAssessmentData(
        userId,
        tenantId,
        organisationId,
        authorization
      );

      // Build complete user structure
      const completeUserStructure = this.buildCompleteUserStructure(
        userId,
        userProfile,
        courseHierarchy,
        assessmentData,
        tenantId,
        organisationId
      );

      // Update lesson tracking in the structure
      this.updateLessonTrackingInStructure(completeUserStructure, lessonTrack);

      // Create/Update document in Elasticsearch
      await this.client.index({
        index: this.indexName,
        id: userId,
        body: completeUserStructure
      });

      this.logger.log(`Created complete user structure with attempt data for userId: ${userId}, attemptId: ${attemptId}`);

    } catch (error) {
      this.logger.error(`Failed to create complete user structure with attempt for userId: ${userId}, attemptId: ${attemptId}:`, error);
      throw error;
    }
  }

  /**
   * Handle enrollment success and update Elasticsearch with proper course format
   * This function is called after successful enrollment to ensure proper course structure
   */
  async handleEnrollmentWithCourseFormat(
    userId: string,
    courseId: string,
    tenantId: string,
    organisationId: string,
    authorization?: string
  ): Promise<void> {
    try {
      this.logger.log(`Handling enrollment with course format for userId: ${userId}, courseId: ${courseId}`);
      
      // Force sync user data from user-microservice first to ensure profile is populated
      await this.forceSyncUserFromMicroservice(userId, authorization);
      
      // Check if user exists in Elasticsearch
      const userExists = await this.checkUserDocumentExists(userId);
      
      if (userExists) {
        this.logger.log(`User ${userId} exists in Elasticsearch, updating with new course data`);
        await this.updateUserWithCourseFormat(userId, courseId, tenantId, organisationId, authorization);
      } else {
        this.logger.log(`User ${userId} not found in Elasticsearch, creating complete user structure`);
        await this.createCompleteUserStructureWithCourseFormat(userId, courseId, tenantId, organisationId, authorization);
      }
      
      this.logger.log(`Successfully handled enrollment with course format for userId: ${userId}, courseId: ${courseId}`);
    } catch (error) {
      this.logger.error(`Failed to handle enrollment with course format for userId: ${userId}, courseId: ${courseId}:`, error);
      throw error;
    }
  }

  /**
   * Update existing user with new course data in proper format
   */
  private async updateUserWithCourseFormat(
    userId: string,
    courseId: string,
    tenantId: string,
    organisationId: string,
    authorization?: string
  ): Promise<void> {
    try {
      // Get existing user data
      const existingUser = await this.getUserFromElasticsearch(userId);
      if (!existingUser) {
        throw new Error(`User ${userId} not found in Elasticsearch`);
      }

      // Fetch course hierarchy with tracking
      const courseHierarchy = await this.fetchCourseHierarchyWithTracking(
        courseId,
        userId,
        tenantId,
        organisationId
      );

      if (!courseHierarchy) {
        this.logger.warn(`No course hierarchy found for courseId: ${courseId}`);
        return;
      }

      // Extract cohortId from course params
      const cohortId = courseHierarchy.params?.cohortId || courseId;

      // Find or create application
      let application = existingUser.applications?.find((app: any) => app.cohortId === cohortId);
      
      if (!application) {
        // Check if any existing application has this course
        application = existingUser.applications?.find((app: any) => 
          app.courses?.values?.some((course: any) => course.courseId === courseId)
        );
      }

      if (!application) {
        // If no application found, use the first existing application or create a new one
        if (existingUser.applications && existingUser.applications.length > 0) {
          // Use the first existing application to merge course data
          application = existingUser.applications[0];
          this.logger.log(`Using existing application with cohortId: ${application.cohortId} to merge course data`);
        } else {
          // Create new application
          application = {
            cohortId: cohortId,
            formId: '',
            submissionId: '',
            cohortmemberstatus: 'enrolled',
            formstatus: 'active',
            completionPercentage: 0,
            progress: {
              pages: {},
              overall: {
                total: 0,
                completed: 0
              }
            },
            lastSavedAt: null,
            submittedAt: null,
            cohortDetails: {
              cohortId: cohortId,
              name: courseHierarchy.title || courseHierarchy.name || 'Unknown Cohort',
              type: 'COHORT',
              status: 'active',
            },
            courses: {
              type: 'nested',
              values: []
            }
          };

          if (!existingUser.applications) {
            existingUser.applications = [];
          }
          existingUser.applications.push(application);
        }
      }

      // Build course data in the required format
      const courseData = this.buildCourseDataFromHierarchy(courseHierarchy, userId, tenantId, organisationId);

      // Find or update course in application
      let existingCourse = application.courses.values.find((c: any) => c.courseId === courseData.courseId);
      
      if (existingCourse) {
        // Update existing course
        existingCourse.courseTitle = courseData.courseTitle;
        existingCourse.progress = courseData.progress;
        existingCourse.units = courseData.units;
      } else {
        // Add new course
        application.courses.values.push(courseData);
      }

      // Update timestamp
      existingUser.updatedAt = new Date().toISOString();

      // Save to Elasticsearch
      await this.client.update({
        index: this.indexName,
        id: userId,
        body: {
          doc: existingUser
        }
      });

      this.logger.log(`Updated user ${userId} with course ${courseId} in proper format`);
    } catch (error) {
      this.logger.error(`Error updating user with course format:`, error);
      throw error;
    }
  }

  /**
   * Create complete user structure with course format for new users
   */
  private async createCompleteUserStructureWithCourseFormat(
    userId: string,
    courseId: string,
    tenantId: string,
    organisationId: string,
    authorization?: string
  ): Promise<void> {
    try {
      // Fetch user profile from user-microservice
      const userProfile = await this.fetchUserProfile(userId, authorization);
      
      // Fetch course hierarchy
      const courseHierarchy = await this.fetchCourseHierarchyWithTracking(
        courseId,
        userId,
        tenantId,
        organisationId
      );

      if (!courseHierarchy) {
        this.logger.warn(`No course hierarchy found for courseId: ${courseId}`);
        return;
      }

      // Extract cohortId from course params
      const cohortId = courseHierarchy.params?.cohortId || courseId;

      // Build complete user structure
      const userData = {
        userId: userId,
        profile: userProfile,
        applications: [
          {
            cohortId: cohortId,
            formId: '',
            submissionId: '',
            cohortmemberstatus: 'enrolled',
            formstatus: 'active',
            completionPercentage: 0,
            progress: {
              pages: {},
              overall: {
                total: 0,
                completed: 0
              }
            },
            lastSavedAt: null,
            submittedAt: null,
            cohortDetails: {
              cohortId: cohortId,
              name: courseHierarchy.title || courseHierarchy.name || 'Unknown Cohort',
              type: 'COHORT',
              status: 'active',
            },
            courses: {
              type: 'nested',
              values: [
                this.buildCourseDataFromHierarchy(courseHierarchy, userId, tenantId, organisationId)
              ]
            }
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save to Elasticsearch
      await this.client.index({
        index: this.indexName,
        id: userId,
        body: userData
      });

      this.logger.log(`Created complete user structure for ${userId} with course ${courseId}`);
    } catch (error) {
      this.logger.error(`Error creating complete user structure with course format:`, error);
      throw error;
    }
  }

  /**
   * Build course data from hierarchy in the required format
   */
  private buildCourseDataFromHierarchy(courseHierarchy: any, userId: string, tenantId: string, organisationId: string): any {
    // Handle both formats: modules/lessons and units/contents
    let units = [];
    
    if (courseHierarchy.modules && Array.isArray(courseHierarchy.modules)) {
      // Format: modules/lessons (from hierarchy API)
      units = courseHierarchy.modules.map((module: any) => ({
        unitId: module.moduleId,
        unitTitle: module.title,
        progress: module.tracking?.progress || 0,
        contents: {
          type: 'nested',
          values: module.lessons?.map((lesson: any) => ({
            contentId: lesson.lessonId,
            lessonId: lesson.lessonId,
            type: lesson.format || 'video',
            title: lesson.title,
            status: lesson.tracking?.status || 'incomplete',
            tracking: {
              timeSpent: lesson.tracking?.timeSpent || 0,
              currentPosition: lesson.tracking?.currentPosition || 0,
              lastPosition: lesson.tracking?.lastPosition || 0,
              percentComplete: lesson.tracking?.percentComplete || 0
            }
          })) || []
        }
      }));
    } else if (courseHierarchy.units && Array.isArray(courseHierarchy.units.values)) {
      // Format: units/contents (from fetchCourseHierarchyWithTracking)
      units = courseHierarchy.units.values.map((unit: any) => ({
        unitId: unit.unitId,
        unitTitle: unit.name,
        progress: unit.progress || 0,
        contents: {
          type: 'nested',
          values: unit.contents?.values?.map((content: any) => ({
            contentId: content.contentId,
            lessonId: content.lessonId,
            type: content.type || 'video',
            title: content.title || content.name,
            status: content.status || 'incomplete',
            tracking: content.tracking || {
              timeSpent: 0,
              currentPosition: 0,
              lastPosition: 0,
              percentComplete: 0
            }
          })) || []
        }
      }));
    }

    const courseData = {
      courseId: courseHierarchy.courseId,
      courseTitle: courseHierarchy.title || courseHierarchy.name,
      progress: courseHierarchy.tracking?.progress || 0,
      units: {
        type: 'nested',
        values: units
      }
    };

    return courseData;
  }

  /**
   * Force sync user data from user-microservice to ensure profile is populated
   * @param userId The user ID
   * @param authorization Optional authorization header
   */
  private async forceSyncUserFromMicroservice(userId: string, authorization?: string): Promise<void> {
    try {
      this.logger.log(`Force syncing user ${userId} from user-microservice`);
      
      const headers: any = {};
      if (authorization) {
        headers.Authorization = authorization;
      }
      headers['Content-Type'] = 'application/json';
      headers['tenantId'] = process.env.TENANT_ID || 'ef99949b-7f3a-4a5f-806a-e67e683e38f3';
      headers['organisationId'] = process.env.ORGANISATION_ID || 'd36d9079-0f42-4ba3-be03-26c9e79509ee';
      headers['userId'] = userId;

      // Force sync from user-microservice
      await this.httpService.axiosRef.post(
        `${this.userMicroserviceUrl}/user/v1/elasticsearch/users/${userId}/sync`,
        {},
        { headers }
      );

      this.logger.log(`Successfully force synced user ${userId} from user-microservice`);
    } catch (error) {
      this.logger.error(`Failed to force sync user ${userId} from user-microservice:`, error.message);
      // Don't throw error, continue with enrollment
    }
  }

  private checkCourseIdMatch(userData: any, courseId: string): void {
    try {
      this.logger.log(`Checking if courseId ${courseId} exists in user structure`);
      
      if (userData.applications && userData.applications.length > 0) {
        for (const application of userData.applications) {
          this.logger.log(`Application cohortId: ${application.cohortId}`);
          
          if (application.courses && application.courses.values && application.courses.values.length > 0) {
            for (const course of application.courses.values) {
              this.logger.log(`Course: ${course.courseId} - ${course.courseTitle}`);
              
              if (course.courseId === courseId) {
                this.logger.log(`✅ Found courseId ${courseId} in user structure!`);
                this.logger.log(`Current status: ${course.status}, tracking status: ${course.tracking?.status}`);
                return;
              }
            }
          }
        }
      }
      
      this.logger.warn(`❌ CourseId ${courseId} not found in user structure`);
    } catch (error) {
      this.logger.error(`Error checking courseId match:`, error);
    }
  }
} 