import {
  HttpStatus,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import axios from 'axios';
import APIResponse from 'src/common/utils/response';
import { LoggerService } from 'src/common/logger/logger/logger.service';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { UserCourseCertificate } from './entities/user_certificates';
import { Templates } from './entities/templates';
import { CourseTemplate } from './entities/course_templates';
import { In, Repository } from 'typeorm';
import { Response } from 'express';
import puppeteer, { Browser } from 'puppeteer';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { GetUserCertificatesDto } from './dto/get-user-certificates-dto';
import { RegenerateCertificatesDto } from './dto/regenerate-certificates-dto';
import { S3Service } from './s3.service';
import { TrackingService } from '../tracking/tracking.service';

@Injectable()
export class CertificateService implements OnModuleInit, OnModuleDestroy {
  /** Reused Chromium instance for PDF/image generation (one process per app). */
  private pooledBrowser: Browser | null = null;
  private pooledBrowserLaunch: Promise<Browser> | null = null;

  // Chromium (+ its renderer/GPU child processes) commonly holds 150-400MB+ of RSS
  // that lives entirely outside V8's heap, so global.gc() has no effect on it. Without
  // an idle timeout, once any pod ever renders a single certificate, that memory stays
  // resident for the pod's entire lifetime — closing only on full app shutdown left
  // pods parked at 1.4-1.7GB indefinitely after their last certificate job finished.
  private pooledBrowserLastUsedAt = 0;
  private pooledBrowserIdleCheckInterval: NodeJS.Timeout | null = null;
  private readonly POOLED_BROWSER_IDLE_TIMEOUT_MS = Math.max(
    60_000,
    (parseInt(process.env.PUPPETEER_IDLE_TIMEOUT_MINUTES || '10', 10) || 10) *
    60_000,
  );

  constructor(
    @InjectRepository(UserCourseCertificate)
    private readonly userCourseCertificateRepository: Repository<UserCourseCertificate>,
    @InjectRepository(Templates)
    private readonly templatesRepository: Repository<Templates>,
    @InjectRepository(CourseTemplate)
    private readonly courseTemplateRepository: Repository<CourseTemplate>,
    private readonly configService: ConfigService,
    private readonly loggerService: LoggerService,
    private readonly s3Service: S3Service,
    private readonly trackingService: TrackingService,
  ) { }

  /**
   * Periodically checks whether the pooled browser has sat idle past
   * POOLED_BROWSER_IDLE_TIMEOUT_MS and closes it if so, releasing Chromium's
   * native-process memory back to the OS during quiet periods instead of only on
   * full app shutdown.
   */
  onModuleInit(): void {
    this.pooledBrowserIdleCheckInterval = setInterval(() => {
      void this.closeBrowserIfIdle();
    }, Math.min(this.POOLED_BROWSER_IDLE_TIMEOUT_MS, 5 * 60_000));
  }

  private async closeBrowserIfIdle(): Promise<void> {
    if (!this.pooledBrowser) {
      return;
    }
    const idleFor = Date.now() - this.pooledBrowserLastUsedAt;
    if (idleFor < this.POOLED_BROWSER_IDLE_TIMEOUT_MS) {
      return;
    }
    const browser = this.pooledBrowser;
    this.pooledBrowser = null;
    try {
      await browser.close();
      this.loggerService.log(
        `Puppeteer: closed pooled browser after ${Math.round(
          idleFor / 60_000,
        )}min idle`,
      );
    } catch {
      // Already exited or failed to close — nothing left to release.
    }
  }

  /**
   * Nest shutdown hook: tear down the shared Puppeteer browser so Chromium
   * exits cleanly (frees CPU/RAM) instead of lingering after the process stops.
   * Clears `pooledBrowserLaunch` so no in-flight launch promise is left dangling.
   */
  async onModuleDestroy(): Promise<void> {
    if (this.pooledBrowserIdleCheckInterval) {
      clearInterval(this.pooledBrowserIdleCheckInterval);
      this.pooledBrowserIdleCheckInterval = null;
    }
    this.pooledBrowserLaunch = null;
    if (this.pooledBrowser) {
      try {
        await this.pooledBrowser.close();
      } catch {
        // Shutdown should not block app exit if Chromium already exited.
      }
      this.pooledBrowser = null;
    }
  }

  /**
   * Puppeteer needs a real Chrome/Chromium binary. Bundled Chrome is only used
   * after `npx puppeteer browsers install chrome`, so we prefer env and OS paths.
   */
  private async resolveBrowserExecutablePath(): Promise<string | undefined> {
    const fromEnv =
      this.configService.get<string>('PUPPETEER_EXECUTABLE_PATH') ||
      process.env.PUPPETEER_EXECUTABLE_PATH ||
      process.env.CHROME_BIN;
    if (fromEnv && existsSync(fromEnv)) {
      return fromEnv;
    }
    const candidates = [
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
    ];
    for (const p of candidates) {
      if (existsSync(p)) {
        return p;
      }
    }
    try {
      const bundled = await puppeteer.executablePath();
      if (bundled && existsSync(bundled)) {
        return bundled;
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : String(err ?? 'unknown error');
      this.loggerService.log(
        `Puppeteer: bundled Chrome path not available (${msg}). Run npx puppeteer browsers install chrome, set PUPPETEER_EXECUTABLE_PATH / CHROME_BIN, or install system Chromium.`,
      );
    }
    return undefined;
  }

  private async getPooledBrowser(): Promise<Browser> {
    this.pooledBrowserLastUsedAt = Date.now();
    if (this.pooledBrowser?.connected) {
      return this.pooledBrowser;
    }
    this.pooledBrowser = null;
    if (this.pooledBrowserLaunch) {
      return this.pooledBrowserLaunch;
    }
    const executablePath = await this.resolveBrowserExecutablePath();
    if (!executablePath) {
      this.loggerService.log(
        'Puppeteer: no Chrome/Chromium found. Install the managed browser (npx puppeteer browsers install chrome) or set PUPPETEER_EXECUTABLE_PATH to your chromium binary.',
      );
    }
    const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-software-rasterizer',
      ],
      ...(executablePath ? { executablePath } : {}),
    };
    this.pooledBrowserLaunch = puppeteer
      .launch(launchOptions)
      .then((browser) => {
        this.pooledBrowser = browser;
        browser.once('disconnected', () => {
          this.pooledBrowser = null;
        });
        return browser;
      })
      .finally(() => {
        this.pooledBrowserLaunch = null;
      });
    return this.pooledBrowserLaunch;
  }

  /**
   * Extract user ID from JWT token (simplified version without jwt library)
   * @param request - Request object containing authorization header
   * @returns string | null - User ID or null if not found
   */
  private extractUserIdFromToken(request: any): string | null {
    try {
      // First try to get userId from request object (for cron jobs)
      if (request.userId) {
        return request.userId;
      }

      // Then try JWT token extraction
      const authHeader = request.headers?.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      const parts = token.split('.');

      if (parts.length !== 3) {
        return null;
      }

      // Decode the payload (second part of JWT)
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

      // Try different possible user ID fields (sub is the standard JWT field for user ID)
      const userId =
        payload?.sub || payload?.id || payload?.userId || payload?.user_id;

      return userId || null;
    } catch (error) {
      this.loggerService.error(
        'Error extracting user ID from token:',
        error.message,
      );
      return null;
    }
  }

  async generateDid(userId: string, res: Response, request: any) {
    let apiId = 'api.generate.did';
    try {
      this.loggerService.log(
        'base: ',
        this.configService.get<string>('RC_IDENTITY_API_BASE_URL'),
      );
      const url =
        this.configService.get<string>('RC_IDENTITY_API_BASE_URL') +
        '/did/generate';
      const response = await axios.post(
        url,
        {
          // options: {
          //   network: 'testnet',
          // },
          content: [
            {
              alsoKnownAs: [userId],
              services: [
                {
                  id: 'IdentityHub',
                  type: 'IdentityHub',
                  serviceEndpoint: {
                    '@context': 'schema.identity.foundation/hub',
                    '@type': 'UserServiceEndpoint',
                    instance: ['did:test:hub.id'],
                  },
                },
              ],
              method: 'rcw',
            },
          ],
        },
        {
          headers: {
            'Content-Type': 'application/json',
            tenantId: request.headers['tenantid'], // 👈 forward from client
            Authorization: request.headers['authorization'], // 👈 if required
          },
        },
      );

      return APIResponse.success(
        res,
        apiId,
        response.data,
        HttpStatus.OK,
        'DID generated successfully',
      );
    } catch (error) {
      this.loggerService.error(
        'Error generating DID:',
        error.response?.data || error.message,
      );
      return APIResponse.error(
        res,
        apiId,
        error.response?.data || error.message,
        'INTERNAL_SERVER_ERROR',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async generateDidByUserId(userId: string) {
    try {
      this.loggerService.log(
        'base: ',
        this.configService.get<string>('RC_IDENTITY_API_BASE_URL'),
      );
      const url =
        this.configService.get<string>('RC_IDENTITY_API_BASE_URL') +
        '/did/generate';
      const response = await axios.post(
        url,
        {
          content: [
            {
              alsoKnownAs: [userId],
              services: [
                {
                  id: 'IdentityHub',
                  type: 'IdentityHub',
                  serviceEndpoint: {
                    '@context': 'schema.identity.foundation/hub',
                    '@type': 'UserServiceEndpoint',
                    instance: ['did:test:hub.id'],
                  },
                },
              ],
              method: 'upai',
            },
          ],
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data[0].id;
    } catch (error) {
      const errMsg = axios.isAxiosError(error)
        ? `${error.message} (HTTP ${error.response?.status ?? '?'})`
        : error instanceof Error
          ? error.message
          : String(error);
      this.loggerService.error('Error generating DID:', errMsg);
      throw new Error(`DID generation failed for userId ${userId}: ${errMsg}`);
    }
  }
  async createCredentialSchema(schema: any, res: Response) {
    const apiId = 'api.create.credentialSchema';
    try {
      const url =
        this.configService.get('RC_CREDENTIAL_SCHEMA_API_BASE_URL') +
        '/schemas';
      const response = await axios.post(url, ...schema, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return APIResponse.success(
        res,
        apiId,
        response.data,
        HttpStatus.CREATED,
        'Credential schema created successfully',
      );
    } catch (error) {
      this.loggerService.error('Error creating credential schema:', error);
      return APIResponse.error(
        res,
        apiId,
        'Error creating credential schema',
        'INTERNAL_SERVER_ERROR',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async createTemplate(
    schemaId: string,
    template: string,
    title: string,
    templateType: string,
    res: Response,
    request: any,
  ) {
    const apiId = 'api.create.template';
    try {
      // Validate template_type
      if (
        !templateType ||
        ![
          'certificate',
          'badge',
          'acknowledgement',
          'paid_certificate',
          'paid_acknowledgement',
        ].includes(templateType.toLowerCase())
      ) {
        this.loggerService.error('Invalid template_type:', templateType);
        return APIResponse.error(
          res,
          apiId,
          'Invalid template_type. Must be "certificate" or "badge" or "acknowledgement" or "paid_certificate" or "paid_acknowledgement"',
          'BAD_REQUEST',
          HttpStatus.BAD_REQUEST,
        );
      }

      const url =
        this.configService.get('RC_CREDENTIAL_SCHEMA_API_BASE_URL') +
        '/template';

      const requestPayload = {
        schemaId: schemaId,
        schemaVersion: '1.0.0',
        template: template,
        type: 'Handlebar',
      };

      const response = await axios.post(url, requestPayload, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Save template record to database
      if (
        response.data &&
        response.data.template &&
        response.data.template.templateId
      ) {
        await this.saveTemplate({
          templateId: response.data.template.templateId,
          templateType: templateType.toLowerCase(),
          title: title,
          request: request,
        });
      } else {
        this.loggerService.warn(
          'External service response does not contain expected template structure',
        );
      }
      return APIResponse.success(
        res,
        apiId,
        response.data,
        HttpStatus.CREATED,
        'Template created successfully',
      );
    } catch (error) {
      this.loggerService.error('Error in createTemplate:', error.message);
      return APIResponse.error(
        res,
        apiId,
        'Error creating template',
        'INTERNAL_SERVER_ERROR',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async issueCertificateAfterCourseCompletion(
    issueCredential: any,
    request: any,
    response: any,
    allowedCertificateTypes?: string[],
    /** When false, skips LMS PATCH and user-service auto_tags (e.g. POST /generate). Default true for /issue and cron. */
    invokeLmsAndUserUpdates: boolean = true,
  ) {
    let apiId = 'api.issueCertificate';
    const today = new Date();
    const options: Intl.DateTimeFormatOptions = {
      month: 'long',
      year: 'numeric',
    };
    const formattedIssuanceDate = today.toLocaleDateString('en-US', options);

    this.loggerService.log('Formatted issuance date:', formattedIssuanceDate); // e.g., "July 2025"

    const issuedOnDbDate = (() => {
      const raw = issueCredential.certificateIssueDateTime;
      if (raw) {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) {
          return d;
        }
      }
      return new Date();
    })();

    try {
      // Fetch names from User Service when firstName is missing (firstName is required; lastName is optional)
      if (!issueCredential.firstName) {
        this.loggerService.log(
          `firstName missing. Fetching from User Service for userId: ${issueCredential.userId}`,
        );
        const userDetails = await this.fetchUserDetailsFromUserService(
          [issueCredential.userId],
          request,
        );
        if (userDetails) {
          console.log('userDetails', userDetails);

          if (!issueCredential.firstName && userDetails.firstName) {
            issueCredential.firstName = userDetails.firstName;
            this.loggerService.log(
              `Fetched firstName from User Service: ${userDetails.firstName}`,
            );
          }
          if (!issueCredential.lastName && userDetails.lastName) {
            issueCredential.lastName = userDetails.lastName;
            this.loggerService.log(
              `Fetched lastName from User Service: ${userDetails.lastName}`,
            );
          }
        }
      }

      if (!issueCredential.firstName) {
        this.loggerService.error(
          'Missing required field firstName after User Service fetch.',
        );
        return APIResponse.error(
          response,
          apiId,
          'firstName is required. Could not fetch from User Service.',
          'BAD_REQUEST',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Determine learner DID – use provided one if present, otherwise generate via identity service
      let learnerDid: string;
      if (issueCredential.learnerDid) {
        learnerDid = issueCredential.learnerDid;
        this.loggerService.log('Using provided learnerDid:', learnerDid);
      } else {
        learnerDid = await this.generateDidByUserId(issueCredential.userId);
        this.loggerService.log('Generated learnerDid:', learnerDid);
      }

      const baseUrl = this.configService.get('RC_CREDENTIALS_API_BASE_URL');
      if (!baseUrl) {
        throw new Error('RC_CREDENTIALS_API_BASE_URL is not configured');
      }
      const url = baseUrl.endsWith('/')
        ? `${baseUrl}credentials/issue`
        : `${baseUrl}/credentials/issue`;

      const credetialObj = {
        credential: {
          '@context': [
            'https://www.w3.org/2018/credentials/v1',
            this.configService.get('VERIFICATION_SCHEMA_URL'),
          ],
          type: [
            'VerifiableCredential',
            this.configService.get('VERIFICATION_SCHEMA_NAME'),
          ],
          issuer: this.configService.get('CERTIFICATE_ISSUER_DID'),
          issuanceDate: issueCredential.issuanceDate,
          expirationDate: issueCredential.expirationDate,
          credentialSubject: {
            id: learnerDid,
            type: this.configService.get('VERIFICATION_SCHEMA_NAME'),
            firstName: issueCredential.firstName,
            middleName: '',
            lastName: issueCredential.lastName ?? '',
            userId: issueCredential.userId,
            courseId: issueCredential.courseId,
            courseName: issueCredential.courseName,
            issuedOn: issueCredential.issuedOn || formattedIssuanceDate,
            // Generate a unique certificate identifier
            certificateId: randomUUID(),
          },
        },
        credentialSchemaId: this.configService.get('SCHEMA_ID'),
        credentialSchemaVersion: '1.0.0',
        tags: [],
      };
      const issueResponse = await axios.post(url, credetialObj, {
        headers: {
          'Content-Type': 'application/json',
          tenantId: request.headers?.['tenantid'] || request.headers?.['tenantId'],
          Authorization: request.headers?.['authorization'] || request.headers?.['Authorization'],
        },
      });

      // Get all templates for this contextId with their certificate types
      const allTemplates = await this.getAllTemplatesByContextId(
        issueCredential.courseId,
      );

      if (!allTemplates || allTemplates.length === 0) {
        this.loggerService.warn(
          `No templates found for courseId: ${issueCredential.courseId}. Certificate will be saved without certificate_type. PDF generation will be skipped.`,
        );
        this.loggerService.warn(
          `To generate PDF and upload to S3, please ensure templates are configured for courseId: ${issueCredential.courseId}`,
        );
      }

      // Apply business logic to filter templates based on certificate type rules
      let templatesToProcess: Array<{
        templateId: string;
        certificateType: string;
      }> = [];

      if (allTemplates && allTemplates.length > 0) {
        // If allowedCertificateTypes is provided, filter by those types only
        if (allowedCertificateTypes && allowedCertificateTypes.length > 0) {
          templatesToProcess = allTemplates.filter((t) =>
            allowedCertificateTypes.includes(t.certificateType.toLowerCase()),
          );
          this.loggerService.log(
            `[CERTIFICATE_TYPE_LOGIC] Filtering by allowed certificate types: ${allowedCertificateTypes.join(
              ', ',
            )}. Found ${templatesToProcess.length} matching template(s).`,
          );
        } else {
          // Get unique certificate types
          const certificateTypes = [
            ...new Set(allTemplates.map((t) => t.certificateType)),
          ];

          this.loggerService.log(
            `[CERTIFICATE_TYPE_LOGIC] Found certificate types for courseId ${issueCredential.courseId
            }: ${certificateTypes.join(', ')}`,
          );

          // Case 1: If badge exists, process only badge (do not generate certificate or acknowledgement)
          if (certificateTypes.includes('badge')) {
            templatesToProcess = allTemplates.filter(
              (t) => t.certificateType === 'badge',
            );
            this.loggerService.log(
              `[CERTIFICATE_TYPE_LOGIC] Badge template found. Processing only badge templates (${templatesToProcess.length} template(s)).`,
            );
          }
          // Case 2: If certificate exists, process certificate AND acknowledgement (if acknowledgement is configured)
          else if (certificateTypes.includes('certificate')) {
            templatesToProcess = allTemplates.filter(
              (t) => t.certificateType === 'certificate',
            );
            this.loggerService.log(
              `[CERTIFICATE_TYPE_LOGIC] Certificate template found. Processing certificate and acknowledgement (if configured).`,
            );
            this.loggerService.log(
              `[CERTIFICATE_TYPE_LOGIC] Templates to process: ${JSON.stringify(
                templatesToProcess.map((t) => ({
                  templateId: t.templateId,
                  type: t.certificateType,
                })),
              )}`,
            );
          }
        }
      }

      const certificateTypeKeys = [
        ...new Set(templatesToProcess.map((t) => t.certificateType)),
      ];
      const existingByType = new Map<string, UserCourseCertificate>();
      if (certificateTypeKeys.length > 0) {
        const existingRows = await this.userCourseCertificateRepository.find({
          where: {
            userId: issueCredential.userId,
            contextId: issueCredential.courseId,
            certificate_type: In(certificateTypeKeys),
          },
        });
        for (const row of existingRows) {
          if (row.certificate_type) {
            existingByType.set(row.certificate_type, row);
          }
        }
      }

      // Process each template and create/update certificates
      const certificateResults: Array<{
        templateId: string;
        certificateType: string;
        action: string;
        certificateId: string;
      }> = [];
      for (const template of templatesToProcess) {
        try {
          this.loggerService.log(
            `Processing template: ${template.templateId} with type: ${template.certificateType}`,
          );

          const existingCertificate = existingByType.get(
            template.certificateType,
          );

          this.loggerService.log(
            `[CERTIFICATE_CHECK] Checking for existing certificate - userId: ${issueCredential.userId
            }, courseId: ${issueCredential.courseId}, certificateType: ${template.certificateType
            }, exists: ${!!existingCertificate}`,
          );

          if (existingCertificate) {
            // Update existing certificate - Generate a NEW credential for this template type
            this.loggerService.log(
              `Found existing certificate for type: ${template.certificateType}, updating...`,
            );

            // Generate a new credential for this specific template type
            const templateCredentialObj = {
              credential: {
                '@context': [
                  'https://www.w3.org/2018/credentials/v1',
                  this.configService.get('VERIFICATION_SCHEMA_URL'),
                ],
                type: [
                  'VerifiableCredential',
                  this.configService.get('VERIFICATION_SCHEMA_NAME'),
                ],
                issuer: this.configService.get('CERTIFICATE_ISSUER_DID'),
                issuanceDate: issueCredential.issuanceDate,
                expirationDate: issueCredential.expirationDate,
                credentialSubject: {
                  id: learnerDid,
                  type: this.configService.get('VERIFICATION_SCHEMA_NAME'),
                  firstName: issueCredential.firstName,
                  middleName: '',
                  lastName: issueCredential.lastName ?? '',
                  userId: issueCredential.userId,
                  courseId: issueCredential.courseId,
                  courseName: issueCredential.courseName,
                  issuedOn: issueCredential.issuedOn || formattedIssuanceDate,
                  certificateId: randomUUID(),
                },
              },
              credentialSchemaId: this.configService.get('SCHEMA_ID'),
              credentialSchemaVersion: '1.0.0',
              tags: [],
            };

            // Call external API to get a unique credential for this template type
            this.loggerService.log(
              `Generating new credential for certificate type: ${template.certificateType} (UPDATE)`,
            );
            this.loggerService.log(
              `Credential payload: ${JSON.stringify(
                templateCredentialObj,
                null,
                2,
              )}`,
            );

            const templateIssueResponse = await axios.post(
              url,
              templateCredentialObj,
              {
                headers: {
                  'Content-Type': 'application/json',
                },
                timeout: 60000, // 60 seconds timeout
              },
            );
            this.loggerService.log(
              `Generated credential ID: ${templateIssueResponse.data.credential.id} for type: ${template.certificateType} (UPDATE)`,
            );

            existingCertificate.certificateId =
              templateIssueResponse.data.credential.id; // Use the new credential ID
            existingCertificate.status = 'issued';
            existingCertificate.issuedOn = issuedOnDbDate;
            existingCertificate.updatedOn = new Date();
            existingCertificate.updatedBy =
              this.extractUserIdFromToken(request) || 'system-user';

            await this.userCourseCertificateRepository.save(
              existingCertificate,
            );

            // Upload certificate image to S3 for all certificate types; persist URL on certificateUrl
            // Delete old certificate image from S3 if it exists
            if (existingCertificate.certificateUrl) {
              try {
                const oldS3Path = this.s3Service.extractKeyFromUrl(
                  existingCertificate.certificateUrl,
                );
                if (oldS3Path) {
                  this.loggerService.log(
                    `Deleting old certificate image from S3: ${oldS3Path} for userId: ${issueCredential.userId}, courseId: ${issueCredential.courseId}`,
                  );
                  await this.s3Service.deleteFile(oldS3Path);
                  this.loggerService.log(
                    `Old certificate image deleted successfully from S3 for userId: ${issueCredential.userId}, courseId: ${issueCredential.courseId}`,
                  );
                }
              } catch (deleteError) {
                this.loggerService.warn(
                  `Failed to delete old certificate image from S3 for userId: ${issueCredential.userId}, courseId: ${issueCredential.courseId}. Error: ${deleteError.message}`,
                );
                // Continue with new image upload even if deletion fails
              }
            }

            // Generate image and upload to S3, then store URL in certificateUrl
            try {
              this.loggerService.log(
                `Starting image generation and S3 upload for certificate: credentialId=${templateIssueResponse.data.credential.id}, templateId=${template.templateId}, certificateType=${template.certificateType}`,
              );
              const s3Url = await this.generateImageAndUploadToS3(
                templateIssueResponse.data.credential.id,
                template.templateId,
                issueCredential.userId,
                issueCredential.courseId,
              );
              if (s3Url) {
                existingCertificate.certificateUrl = s3Url;
                await this.userCourseCertificateRepository.save(
                  existingCertificate,
                );
                this.loggerService.log(
                  `Certificate image uploaded and certificateUrl updated successfully. URL: ${s3Url} for userId: ${issueCredential.userId}, courseId: ${issueCredential.courseId}`,
                );
              } else {
                this.loggerService.warn(
                  `Image generation or S3 upload returned null. certificateUrl will remain null for userId: ${issueCredential.userId}, courseId: ${issueCredential.courseId}, credentialId: ${templateIssueResponse.data.credential.id}`,
                );
              }
            } catch (imageError) {
              this.loggerService.error(
                `Error uploading certificate image to S3: ${imageError.message}`,
              );
              if (imageError.stack) {
                this.loggerService.error(`Error stack: ${imageError.stack}`);
              }
              // Continue even if image upload fails
            }

            certificateResults.push({
              templateId: template.templateId,
              certificateType: template.certificateType,
              action: 'updated',
              certificateId: existingCertificate.usercertificateId,
            });

            this.loggerService.log(
              `Certificate updated for userId: ${issueCredential.userId}, courseId: ${issueCredential.courseId}, certificateType: ${template.certificateType}`,
            );
          } else {
            // Create new certificate - Generate a NEW credential for each template type
            this.loggerService.log(
              `No existing certificate for type: ${template.certificateType}, creating new...`,
            );

            // Double-check that certificate doesn't already exist before creating (race condition prevention)
            // This check happens again after the initial check to catch any race conditions
            const duplicateCheck =
              await this.userCourseCertificateRepository.findOne({
                where: {
                  userId: issueCredential.userId,
                  contextId: issueCredential.courseId,
                  certificate_type: template.certificateType,
                },
              });

            if (duplicateCheck) {
              this.loggerService.warn(
                `[DUPLICATE_PREVENTION] Certificate of type ${template.certificateType} already exists for user ${issueCredential.userId}, course ${issueCredential.courseId}. Skipping creation to prevent duplicate.`,
              );
              // Skip this template - it already exists (should have been caught by initial check)
              continue;
            }

            // Generate a new credential for this specific template type
            const templateCredentialObj = {
              credential: {
                '@context': [
                  'https://www.w3.org/2018/credentials/v1',
                  this.configService.get('VERIFICATION_SCHEMA_URL'),
                ],
                type: [
                  'VerifiableCredential',
                  this.configService.get('VERIFICATION_SCHEMA_NAME'),
                ],
                issuer: this.configService.get('CERTIFICATE_ISSUER_DID'),
                issuanceDate: issueCredential.issuanceDate,
                expirationDate: issueCredential.expirationDate,
                credentialSubject: {
                  id: learnerDid,
                  type: this.configService.get('VERIFICATION_SCHEMA_NAME'),
                  firstName: issueCredential.firstName,
                  middleName: '',
                  lastName: issueCredential.lastName ?? '',
                  userId: issueCredential.userId,
                  courseId: issueCredential.courseId,
                  courseName: issueCredential.courseName,
                  issuedOn: issueCredential.issuedOn || formattedIssuanceDate,
                  certificateId: randomUUID(),
                },
              },
              credentialSchemaId: this.configService.get('SCHEMA_ID'),
              credentialSchemaVersion: '1.0.0',
              tags: [],
            };

            // Call external API to get a unique credential for this template type
            this.loggerService.log(
              `Generating new credential for certificate type: ${template.certificateType} (CREATE)`,
            );
            this.loggerService.log(
              `Credential payload: ${JSON.stringify(
                templateCredentialObj,
                null,
                2,
              )}`,
            );

            const templateIssueResponse = await axios.post(
              url,
              templateCredentialObj,
              {
                headers: {
                  'Content-Type': 'application/json',
                },
                timeout: 60000, // 60 seconds timeout
              },
            );
            this.loggerService.log(
              `Generated credential ID: ${templateIssueResponse.data.credential.id} for type: ${template.certificateType} (CREATE)`,
            );

            const userCertificate = new UserCourseCertificate();
            userCertificate.usercertificateId = randomUUID();
            userCertificate.userId = issueCredential.userId;
            userCertificate.contextId = issueCredential.courseId;
            userCertificate.contextType = 'courses';
            userCertificate.certificateId =
              templateIssueResponse.data.credential.id; // Use the new credential ID
            userCertificate.status = 'issued';
            userCertificate.issuedOn = issuedOnDbDate;
            userCertificate.tenantId = request.headers['tenantid'];
            userCertificate.certificate_type = template.certificateType;

            const userId =
              this.extractUserIdFromToken(request) || 'system-user';
            userCertificate.createdBy = userId;
            userCertificate.updatedBy = userId;
            userCertificate.createdOn = new Date();
            userCertificate.updatedOn = new Date();

            await this.userCourseCertificateRepository.save(userCertificate);
            existingByType.set(template.certificateType, userCertificate);

            // Generate image and upload to S3, then store URL in certificateUrl
            try {
              this.loggerService.log(
                `Starting image generation and S3 upload for certificate: credentialId=${templateIssueResponse.data.credential.id}, templateId=${template.templateId}, certificateType=${template.certificateType}`,
              );
              const s3Url = await this.generateImageAndUploadToS3(
                templateIssueResponse.data.credential.id,
                template.templateId,
                issueCredential.userId,
                issueCredential.courseId,
              );
              if (s3Url) {
                userCertificate.certificateUrl = s3Url;
                await this.userCourseCertificateRepository.save(
                  userCertificate,
                );
                this.loggerService.log(
                  `Certificate image uploaded and certificateUrl updated successfully. URL: ${s3Url} for userId: ${issueCredential.userId}, courseId: ${issueCredential.courseId}`,
                );
              } else {
                this.loggerService.warn(
                  `Image generation or S3 upload returned null. certificateUrl will remain null for userId: ${issueCredential.userId}, courseId: ${issueCredential.courseId}, credentialId: ${templateIssueResponse.data.credential.id}`,
                );
              }
            } catch (imageError) {
              this.loggerService.error(
                `Error uploading certificate image to S3: ${imageError.message}`,
              );
              if (imageError.stack) {
                this.loggerService.error(`Error stack: ${imageError.stack}`);
              }
              // Continue even if image upload fails
            }

            certificateResults.push({
              templateId: template.templateId,
              certificateType: template.certificateType,
              action: 'created',
              certificateId: userCertificate.usercertificateId,
            });

            this.loggerService.log(
              `Certificate created for userId: ${issueCredential.userId}, courseId: ${issueCredential.courseId}, certificateType: ${template.certificateType}`,
            );
          }
        } catch (templateError) {
          // Log error for this specific template but continue with next template
          this.loggerService.error(
            `[TEMPLATE_ERROR] Error processing template ${template.templateId} (type: ${template.certificateType}) for user ${issueCredential.userId}, course ${issueCredential.courseId}: ${templateError.message}`,
          );
          if (templateError.stack) {
            this.loggerService.error(
              `[TEMPLATE_ERROR] Stack trace: ${templateError.stack}`,
            );
          }
          // Continue to next template instead of stopping the entire process
          continue;
        }
      }

      // Note: Certificates are already saved in the template processing loop above
      // No need to save again using the legacy credential ID

      if (invokeLmsAndUserUpdates) {
        await this.updateLmsCertificateStatus(
          issueCredential.courseId,
          issueCredential.userId,
          issueCredential.firstName,
          issueCredential.lastName ?? '',
          issueCredential.courseTitle,
        );

        await this.updateUserAutoTags(
          issueCredential.userId,
          certificateResults,
          request,
        );
      }

      // Log summary of processed certificates
      this.loggerService.log(
        `[CERTIFICATE_SUMMARY] Processed ${certificateResults.length} certificate(s) for user ${issueCredential.userId}, course ${issueCredential.courseId}:`,
      );
      certificateResults.forEach((result) => {
        this.loggerService.log(
          `[CERTIFICATE_SUMMARY] - ${result.certificateType}: ${result.action} (templateId: ${result.templateId}, certificateId: ${result.certificateId})`,
        );
      });

      return APIResponse.success(
        response,
        apiId,
        {
          credential: issueResponse.data,
          certificates: certificateResults,
          summary: {
            totalTemplates: allTemplates.length,
            certificatesProcessed: certificateResults.length,
            updated: certificateResults.filter((r) => r.action === 'updated')
              .length,
            created: certificateResults.filter((r) => r.action === 'created')
              .length,
          },
        },
        HttpStatus.OK,
        'Credential issued successfully',
      );
    } catch (error) {
      this.loggerService.log(error);
      this.loggerService.error('Error while issuing credentials:', error);
      return APIResponse.error(
        response,
        apiId,
        'Error while issuing credentials',
        'INTERNAL_SERVER_ERROR',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Re-issue credentials for existing user_certificates rows (same flow as the
   * "existing certificate" branch in issueCertificateAfterCourseCompletion).
   */
  async regenerateCertificatesForUser(
    dto: RegenerateCertificatesDto,
    request: any,
    response: Response,
  ) {
    const apiId = 'api.regenerateCertificates';
    const today = new Date();
    const formattedIssuanceDate = today.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    try {
      const { userId, certificateIds } = dto;

      const rows = await this.userCourseCertificateRepository
        .createQueryBuilder('uc')
        .where('uc.userId = :userId', { userId })
        .andWhere(
          '(uc.certificateId IN (:...ids) OR uc.usercertificateId IN (:...ids))',
          { ids: certificateIds },
        )
        .getMany();

      const missingIds = certificateIds.filter(
        (id) =>
          !rows.some(
            (r) => r.certificateId === id || r.usercertificateId === id,
          ),
      );

      if (rows.length === 0) {
        return APIResponse.error(
          response,
          apiId,
          'No certificates found for this user and the given certificateIds',
          'NOT_FOUND',
          HttpStatus.NOT_FOUND,
        );
      }

      const seen = new Set<string>();
      const uniqueRows = rows.filter((r) => {
        if (seen.has(r.usercertificateId)) {
          return false;
        }
        seen.add(r.usercertificateId);
        return true;
      });

      const issueCredential: any = {
        userId,
        firstName: dto.firstName,
        lastName: dto.lastName,
        courseName: dto.courseName ?? 'Course',
        courseTitle: dto.courseTitle ?? dto.courseName ?? 'Course',
        issuanceDate: dto.issuanceDate ?? new Date().toISOString(),
        expirationDate:
          dto.expirationDate ??
          new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      };

      if (!issueCredential.firstName) {
        this.loggerService.log(
          `Regenerate: fetching user names from User Service for userId: ${userId}`,
        );
        const userDetails = await this.fetchUserDetailsFromUserService(
          [userId],
          request,
        );
        if (userDetails) {
          if (!issueCredential.firstName && userDetails.firstName) {
            issueCredential.firstName = userDetails.firstName;
          }
          if (!issueCredential.lastName && userDetails.lastName) {
            issueCredential.lastName = userDetails.lastName;
          }
        }
      }

      if (!issueCredential.firstName) {
        return APIResponse.error(
          response,
          apiId,
          'firstName is required or must be retrievable from User Service.',
          'BAD_REQUEST',
          HttpStatus.BAD_REQUEST,
        );
      }

      const baseUrl = this.configService.get('RC_CREDENTIALS_API_BASE_URL');
      if (!baseUrl) {
        throw new Error('RC_CREDENTIALS_API_BASE_URL is not configured');
      }
      const issueUrl = baseUrl.endsWith('/')
        ? `${baseUrl}credentials/issue`
        : `${baseUrl}/credentials/issue`;

      const learnerDid = await this.generateDidByUserId(userId);

      const certificateResults: Array<{
        templateId: string;
        certificateType: string;
        action: string;
        certificateId: string;
        contextId: string;
        newCredentialId: string;
      }> = [];
      const errors: Array<{ usercertificateId?: string; message: string }> = [];

      for (const existingCertificate of uniqueRows) {
        const certType = existingCertificate.certificate_type;
        if (!certType) {
          errors.push({
            usercertificateId: existingCertificate.usercertificateId,
            message:
              'certificate_type is missing on record; cannot resolve template',
          });
          continue;
        }

        const allTemplates = await this.getAllTemplatesByContextId(
          existingCertificate.contextId,
        );
        const template = allTemplates.find(
          (t) => t.certificateType.toLowerCase() === certType.toLowerCase(),
        );

        if (!template) {
          errors.push({
            usercertificateId: existingCertificate.usercertificateId,
            message: `No template for contextId ${existingCertificate.contextId} and certificate_type ${certType}`,
          });
          continue;
        }

        issueCredential.courseId = existingCertificate.contextId;

        const issuedOnForCredential = existingCertificate.issuedOn
          ? new Date(existingCertificate.issuedOn).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
          })
          : formattedIssuanceDate;

        const templateCredentialObj = {
          credential: {
            '@context': [
              'https://www.w3.org/2018/credentials/v1',
              this.configService.get('VERIFICATION_SCHEMA_URL'),
            ],
            type: [
              'VerifiableCredential',
              this.configService.get('VERIFICATION_SCHEMA_NAME'),
            ],
            issuer: this.configService.get('CERTIFICATE_ISSUER_DID'),
            issuanceDate: issueCredential.issuanceDate,
            expirationDate: issueCredential.expirationDate,
            credentialSubject: {
              id: learnerDid,
              type: this.configService.get('VERIFICATION_SCHEMA_NAME'),
              firstName: issueCredential.firstName,
              middleName: '',
              lastName: issueCredential.lastName ?? '',
              userId: issueCredential.userId,
              courseId: issueCredential.courseId,
              courseName: issueCredential.courseName,
              issuedOn: issuedOnForCredential,
              certificateId: '**Id**',
            },
          },
          credentialSchemaId: this.configService.get('SCHEMA_ID'),
          credentialSchemaVersion: '1.0.0',
          tags: [],
        };

        try {
          this.loggerService.log(
            `Regenerate: new credential for usercertificateId=${existingCertificate.usercertificateId}, type=${template.certificateType}`,
          );

          const templateIssueResponse = await axios.post(
            issueUrl,
            templateCredentialObj,
            {
              headers: { 'Content-Type': 'application/json' },
              timeout: 60000,
            },
          );

          const oldCertificateUrl = existingCertificate.certificateUrl;

          existingCertificate.certificateId =
            templateIssueResponse.data.credential.id;
          existingCertificate.status = 'issued';
          existingCertificate.updatedOn = new Date();
          existingCertificate.updatedBy =
            this.extractUserIdFromToken(request) || 'system-user';

          await this.userCourseCertificateRepository.save(existingCertificate);

          // Upload certificate image to S3 for all certificate types; persist URL on certificateUrl
          if (oldCertificateUrl) {
            try {
              const oldS3Path =
                this.s3Service.extractKeyFromUrl(oldCertificateUrl);
              if (oldS3Path) {
                this.loggerService.log(
                  `Regenerate: deleting old S3 object ${oldS3Path}`,
                );
                await this.s3Service.deleteFile(oldS3Path);
              }
            } catch (deleteError) {
              this.loggerService.warn(
                `Regenerate: failed to delete old S3 file: ${deleteError.message}`,
              );
            }
          }

          try {
            const s3Url = await this.generateImageAndUploadToS3(
              templateIssueResponse.data.credential.id,
              template.templateId,
              userId,
              existingCertificate.contextId,
            );
            if (s3Url) {
              existingCertificate.certificateUrl = s3Url;
              await this.userCourseCertificateRepository.save(
                existingCertificate,
              );
            }
          } catch (imageError) {
            this.loggerService.error(
              `Regenerate: S3 upload error: ${imageError.message}`,
            );
          }

          certificateResults.push({
            templateId: template.templateId,
            certificateType: template.certificateType,
            action: 'updated',
            certificateId: existingCertificate.usercertificateId,
            contextId: existingCertificate.contextId,
            newCredentialId: existingCertificate.certificateId,
          });
        } catch (templateError) {
          this.loggerService.error(
            `Regenerate: error for usercertificateId ${existingCertificate.usercertificateId}: ${templateError.message}`,
          );
          errors.push({
            usercertificateId: existingCertificate.usercertificateId,
            message: templateError.message,
          });
        }
      }

      const successCourseIds = [
        ...new Set(certificateResults.map((r) => r.contextId)),
      ];
      for (const courseId of successCourseIds) {
        await this.updateLmsCertificateStatus(
          courseId,
          userId,
          issueCredential.firstName,
          issueCredential.lastName ?? '',
          issueCredential.courseTitle ?? issueCredential.courseName,
        );
      }

      if (certificateResults.length > 0) {
        await this.updateUserAutoTags(userId, certificateResults, request);
      }

      return APIResponse.success(
        response,
        apiId,
        {
          certificates: certificateResults,
          ...(errors.length > 0 ? { errors } : {}),
          ...(missingIds.length > 0
            ? { missingCertificateIds: missingIds }
            : {}),
        },
        HttpStatus.OK,
        'Certificates regenerated successfully',
      );
    } catch (error) {
      this.loggerService.error('regenerateCertificatesForUser:', error);
      return APIResponse.error(
        response,
        apiId,
        'Error while regenerating certificates',
        'INTERNAL_SERVER_ERROR',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateUserCertificate(data: any) {
    try {
      // Validate required fields
      if (!data.userId || !data.courseId || !data.certificateId) {
        this.loggerService.error(
          `Missing required fields for updating user certificate: userId=${data.userId}, courseId=${data.courseId}, certificateId=${data.certificateId}`,
        );
        return;
      }

      const userCertificate =
        await this.userCourseCertificateRepository.findOne({
          where: { userId: data.userId, contextId: data.courseId },
        });

      if (userCertificate) {
        userCertificate.certificateId = data.certificateId;
        userCertificate.issuedOn = data.issuedOn;
        userCertificate.status = data.status;

        // Get templateId from course_template table using courseId
        const templateId = await this.getTemplateIdByContextId(data.courseId);

        // Get certificate_type from template table using templateId
        const certificateType = templateId
          ? await this.getCertificateTypeByTemplateId(templateId)
          : null;
        userCertificate.certificate_type = certificateType;

        await this.userCourseCertificateRepository.save(userCertificate);

        this.loggerService.log(
          `User certificate updated successfully for userId: ${data.userId}, courseId: ${data.courseId}, certificateType: ${certificateType}`,
        );
      } else {
        this.loggerService.warn(
          `No existing certificate found for userId: ${data.userId}, courseId: ${data.courseId}`,
        );
      }
    } catch (error) {
      this.loggerService.error(
        `Error while updating usercertificate: ${error.message}, userId=${data.userId}, courseId=${data.courseId}, certificateId=${data.certificateId}`,
      );
    }
  }

  /**
   * Update LMS certificate status after successful certificate issuance
   * Directly updates course tracking via TrackingService
   * @param courseId - Course ID
   * @param userId - User ID
   * @param firstName - User's first name
   * @param lastName - User's last name
   * @param courseTitle - Course title
   */
  async updateLmsCertificateStatus(
    courseId: string,
    userId: string,
    firstName: string,
    lastName: string,
    courseTitle: string,
  ): Promise<void> {
    try {
      const tenantId =
        this.configService.get<string>('TENANT_ID') || process.env.TENANT_ID;
      const organisationId =
        this.configService.get<string>('ORGANISATION_ID') ||
        process.env.ORGANISATION_ID;

      if (!tenantId || !organisationId) {
        this.loggerService.warn(
          'Tenant / Organisation configuration missing. Skipping certificate status update.',
        );
        return;
      }

      await this.trackingService.updateCourseTracking(
        courseId,
        userId,
        { certificateIssued: true },
        tenantId,
        organisationId,
      );

      this.loggerService.log(
        `Updated course tracking certificateIssued status for course ${courseId}, user ${userId}`,
      );
    } catch (error) {
      this.loggerService.error(
        `Error updating LMS certificate status for course ${courseId}, user ${userId}: ${error.message}`,
      );
    }
  }
  async renderCredentials(
    credentialId: string,
    templateId: string,
    res: Response,
  ): Promise<void> {
    const apiId = 'api.get.Certificate';
    try {
      let url =
        this.configService.get('RC_CREDENTIALS_API_BASE_URL') +
        '/credentials/' +
        credentialId;
      const response = await axios.get(url, {
        headers: {
          templateid: templateId,
          Accept: 'text/html',
        },
      });
      response.data = response?.data?.replace('**Id**', credentialId);
      APIResponse.success(
        res,
        apiId,
        response.data,
        HttpStatus.OK,
        'Credential rendered successfully',
      );
    } catch (error) {
      const errMsg = axios.isAxiosError(error)
        ? `${error.message}${error.response != null ? ` (HTTP ${error.response.status})` : ''
        }`
        : error instanceof Error
          ? error.message
          : String(error);
      this.loggerService.error('Error fetching credentials:', errMsg);
      if (!res.headersSent) {
        APIResponse.error(
          res,
          apiId,
          'Error fetching credentials',
          'INTERNAL_SERVER_ERROR',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  /**
   * Streams raw `application/pdf` on `res` (legacy contract: only credentialId + templateId).
   * Gateways that always JSON-stringify upstream bodies cannot carry binary; call this
   * service directly (see app listen port) or configure the gateway file-route env, not here.
   */
  async renderPDFFromHTML(
    credentialId: string,
    templateId: string,
    res: Response,
  ): Promise<void> {
    const apiId = 'api.get.Certificate';

    try {
      let url =
        this.configService.get('RC_CREDENTIALS_API_BASE_URL') +
        '/credentials/' +
        credentialId;
      const response = await axios.get(url, {
        headers: {
          templateid: templateId,
          Accept: 'text/html',
        },
      });
      response.data = response?.data?.replace('**Id**', credentialId);

      const browser = await this.getPooledBrowser();
      const page = await browser.newPage();
      try {
        await page.setContent(response.data, { waitUntil: 'load' });

        const templateType = await this.getCertificateTypeByTemplateId(
          templateId,
        );
        const isPaidAcknowledgement =
          templateType?.toLowerCase() === 'paid_acknowledgement';

        const rawPdf = await page.pdf({
          width: isPaidAcknowledgement ? '785px' : '1100px',
          height: isPaidAcknowledgement ? '987px' : '900px',
          printBackground: true,
        });
        const pdfBuffer = Buffer.isBuffer(rawPdf)
          ? rawPdf
          : Buffer.from(rawPdf as Uint8Array);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="generated.pdf"',
        );
        res.setHeader('Content-Length', String(pdfBuffer.length));
        res.end(pdfBuffer);
      } finally {
        await page.close().catch(() => undefined);
      }
    } catch (error) {
      const errMsg = axios.isAxiosError(error)
        ? `${error.message}${error.response != null ? ` (HTTP ${error.response.status})` : ''
        }`
        : error instanceof Error
          ? error.message
          : String(error);
      this.loggerService.error('Error fetching credentials:', errMsg);
      if (!res.headersSent) {
        APIResponse.error(
          res,
          apiId,
          'Error fetching credentials',
          'INTERNAL_SERVER_ERROR',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  /**
   * Generate image (PNG) from certificate HTML and upload to S3
   * @param credentialId - Credential ID
   * @param templateId - Template ID
   * @param userId - User ID for file naming
   * @param courseId - Course ID for file naming
   * @returns Promise<string | null> - S3 URL of uploaded image or null if failed
   */
  private async generateImageAndUploadToS3(
    credentialId: string,
    templateId: string,
    userId: string,
    courseId: string,
  ): Promise<string | null> {
    try {
      this.loggerService.log(
        `Generating image for certificate: credentialId=${credentialId}, templateId=${templateId}, userId=${userId}, courseId=${courseId}`,
      );

      // Fetch certificate HTML
      const credentialsApiUrl = this.configService.get(
        'RC_CREDENTIALS_API_BASE_URL',
      );
      if (!credentialsApiUrl) {
        this.loggerService.error(
          'RC_CREDENTIALS_API_BASE_URL is not configured. Cannot fetch certificate HTML.',
        );
        return null;
      }

      let url = credentialsApiUrl.endsWith('/')
        ? `${credentialsApiUrl}credentials/${credentialId}`
        : `${credentialsApiUrl}/credentials/${credentialId}`;

      this.loggerService.log(`Fetching certificate HTML from: ${url}`);

      const response = await axios.get(url, {
        headers: {
          templateid: templateId,
          Accept: 'text/html',
        },
      });

      if (!response.data) {
        this.loggerService.error(
          `No HTML content received from credentials API for credentialId=${credentialId}`,
        );
        return null;
      }

      const htmlContent = response?.data?.replace('**Id**', credentialId);

      const browser = await this.getPooledBrowser();
      const page = await browser.newPage();
      let imageBuffer: Buffer;
      try {
        const templateType = await this.getCertificateTypeByTemplateId(
          templateId,
        );
        const isPaidAcknowledgement =
          templateType?.toLowerCase() === 'paid_acknowledgement';

        await page.setViewport({
          width: isPaidAcknowledgement ? 789 : 1100,
          height: isPaidAcknowledgement ? 987 : 900,
        });

        await page.setContent(htmlContent, { waitUntil: 'load' });

        const shot = await page.screenshot({
          type: 'png',
          fullPage: false,
        });
        // `screenshot()` may return a Buffer or a binary string depending on options;
        // S3 upload expects a Buffer, so reuse it when already a Buffer, else copy bytes.
        imageBuffer = Buffer.isBuffer(shot) ? shot : Buffer.from(shot);
      } finally {
        await page.close().catch(() => undefined);
      }

      const prefix =
        process.env.AWS_STORAGE_CERTIFICATE_PREFIX || 'certificates/';
      const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '');
      const fileName = `certificate-${userId}-${courseId}-${credentialId}-${Date.now()}.png`;
      const s3Key = `${cleanPrefix}/${fileName}`;

      this.loggerService.log(`Uploading image to S3 with key: ${s3Key}`);

      const s3Url = await this.s3Service.uploadFile(
        imageBuffer,
        s3Key,
        'image/png',
      );

      this.loggerService.log(
        `Certificate image uploaded to S3 successfully: ${s3Url} for credentialId=${credentialId}`,
      );

      return s3Url;
    } catch (error) {
      this.loggerService.error(
        `Error generating image and uploading to S3 for credentialId=${credentialId}, templateId=${templateId}, userId=${userId}, courseId=${courseId}:`,
        error.message,
      );
      if (error.stack) {
        this.loggerService.error(`Error stack: ${error.stack}`);
      }
      if (error.response) {
        this.loggerService.error(
          `HTTP Error Response: ${JSON.stringify(error.response.data)}`,
        );
      }
      return null;
    }
  }

  /**
   * Get template type from templates table using templateId
   * @param templateId - Template ID to search for template type
   * @returns Promise<string | null> - Template type or null if not found
   */
  async getTemplateTypeByTemplateId(
    templateId: string,
  ): Promise<string | null> {
    try {
      const template = await this.templatesRepository.findOne({
        where: { templateId: templateId },
        select: ['template_type'],
      });

      const templateType = template?.template_type || null;

      return templateType;
    } catch (error) {
      this.loggerService.error('Error fetching template type:', error);
      return null;
    }
  }

  /**
   * Get templateId from course_template table using contextId (courseId)
   * @param contextId - Context ID (courseId) to search for templateId
   * @returns Promise<string | null> - TemplateId or null if not found
   */
  async getTemplateIdByContextId(contextId: string): Promise<string | null> {
    try {
      if (!contextId) {
        this.loggerService.warn(
          'getTemplateIdByContextId: contextId is required',
        );
        return null;
      }

      const courseTemplate = await this.courseTemplateRepository.findOne({
        where: { contextId: contextId },
        select: ['templateId'],
      });

      return courseTemplate?.templateId || null;
    } catch (error) {
      this.loggerService.error(
        `Error fetching templateId by contextId ${contextId}:`,
        error.message,
      );
      return null;
    }
  }

  /**
   * Get all templates for a contextId with their certificate types
   * @param contextId - Context ID (course ID)
   * @returns Promise<Array<{templateId: string, certificateType: string}>> - Array of templates with types
   */
  async getAllTemplatesByContextId(
    contextId: string,
  ): Promise<Array<{ templateId: string; certificateType: string }>> {
    try {
      if (!contextId) {
        this.loggerService.warn(
          'getAllTemplatesByContextId: contextId is required',
        );
        return [];
      }

      // Get all course templates for this contextId
      const courseTemplates = await this.courseTemplateRepository.find({
        where: { contextId: contextId },
        select: ['templateId'],
      });

      if (!courseTemplates || courseTemplates.length === 0) {
        this.loggerService.warn(
          `No course templates found for contextId: ${contextId}`,
        );
        return [];
      }

      const templateIds = [
        ...new Set(
          courseTemplates
            .map((ct) => ct.templateId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      if (templateIds.length === 0) {
        return [];
      }

      const templateRows = await this.templatesRepository.find({
        where: { templateId: In(templateIds) },
        select: ['templateId', 'template_type'],
      });
      const typeByTemplateId = new Map<string, string>();
      for (const row of templateRows) {
        if (row.templateId && row.template_type) {
          typeByTemplateId.set(row.templateId, row.template_type);
        }
      }

      const templatesWithTypes: Array<{
        templateId: string;
        certificateType: string;
      }> = [];
      for (const courseTemplate of courseTemplates) {
        const tid = courseTemplate.templateId;
        if (!tid) {
          continue;
        }
        const certificateType = typeByTemplateId.get(tid);
        if (certificateType) {
          templatesWithTypes.push({
            templateId: tid,
            certificateType,
          });
        }
      }

      this.loggerService.log(
        `Found ${templatesWithTypes.length} templates for contextId: ${contextId}`,
      );
      this.loggerService.log(
        'Templates:',
        JSON.stringify(templatesWithTypes, null, 2),
      );

      return templatesWithTypes;
    } catch (error) {
      this.loggerService.error(
        `Error fetching all templates by contextId ${contextId}:`,
        error.message,
      );
      return [];
    }
  }

  /**
   * Get contextId from course_template table using templateId
   * @param templateId - Template ID to search for contextId
   * @returns Promise<string | null> - ContextId or null if not found
   */
  async getContextIdByTemplateId(templateId: string): Promise<string | null> {
    try {
      const courseTemplate = await this.courseTemplateRepository.findOne({
        where: { templateId: templateId },
        select: ['contextId'],
      });

      return courseTemplate?.contextId || null;
    } catch (error) {
      this.loggerService.error(
        'Error fetching contextId by templateId:',
        error,
      );
      return null;
    }
  }

  /**
   * Get certificate_type from template table using templateId
   * @param templateId - Template ID to search for certificate_type
   * @returns Promise<string | null> - Certificate type or null if not found
   */
  async getCertificateTypeByTemplateId(
    templateId: string,
  ): Promise<string | null> {
    try {
      if (!templateId) {
        this.loggerService.warn(
          'getCertificateTypeByTemplateId: templateId is required',
        );
        return null;
      }

      const template = await this.templatesRepository.findOne({
        where: { templateId: templateId },
        select: ['template_type'],
      });

      return template?.template_type || null;
    } catch (error) {
      this.loggerService.error(
        `Error fetching certificate_type by templateId ${templateId}:`,
        error.message,
      );
      return null;
    }
  }

  /**
   * Get template type by courseId (temporary method for backward compatibility)
   * This method looks up the certificate record and gets the templateId from there
   * @param courseId - Course ID to search for template type
   * @returns Promise<string | null> - Template type or null if not found
   */
  async getTemplateTypeByCourseId(courseId: string): Promise<string | null> {
    try {
      // First, find the user certificate record to get the templateId
      const userCertificate =
        await this.userCourseCertificateRepository.findOne({
          where: { contextId: courseId },
          select: ['certificateId'], // Assuming certificateId contains the templateId
        });

      if (!userCertificate?.certificateId) {
        return null;
      }

      // Now look up the template type using the templateId
      return await this.getTemplateTypeByTemplateId(
        userCertificate.certificateId,
      );
    } catch (error) {
      this.loggerService.error(
        'Error fetching template type by courseId:',
        error,
      );
      return null;
    }
  }

  /**
   * Save user certificate record to database after successful certificate issuance
   * @param certificateData - Data from certificate issuance
   * @param request - Request object to extract headers
   */
  async saveUserCertificate(
    certificateData: {
      userId: string;
      courseId: string;
      certificateId: string;
      issuedOn: string;
      certificate_type?: string;
    },
    request: any,
  ): Promise<void> {
    try {
      // Validate required fields
      if (
        !certificateData.userId ||
        !certificateData.courseId ||
        !certificateData.certificateId ||
        !certificateData.certificate_type
      ) {
        this.loggerService.error(
          `Missing required fields for saving user certificate: userId=${certificateData.userId}, courseId=${certificateData.courseId}, certificateId=${certificateData.certificateId}, certificateType=${certificateData.certificate_type}`,
        );
        return;
      }

      // Check if certificate already exists for this userId and contextId
      const existingCertificate =
        await this.userCourseCertificateRepository.findOne({
          where: {
            userId: certificateData.userId,
            contextId: certificateData.courseId,
            certificate_type: certificateData.certificate_type,
          },
        });

      if (existingCertificate) {
        // Update existing record instead of creating new one
        existingCertificate.certificateId = certificateData.certificateId;
        existingCertificate.status = 'issued';
        existingCertificate.issuedOn = new Date(certificateData.issuedOn);
        existingCertificate.updatedOn = new Date();
        existingCertificate.updatedBy = request
          ? this.extractUserIdFromRequest(request)
          : request?.headers?.['user-id'];

        // Get templateId from course_template table using courseId
        const templateId = await this.getTemplateIdByContextId(
          certificateData.courseId,
        );

        // Get certificate_type from template table using templateId
        const certificateType = templateId
          ? await this.getCertificateTypeByTemplateId(templateId)
          : null;
        existingCertificate.certificate_type = certificateType;

        await this.userCourseCertificateRepository.save(existingCertificate);

        return;
      }

      // Create new certificate record
      const userCertificate = new UserCourseCertificate();
      userCertificate.usercertificateId = randomUUID(); // Manually generate UUID
      userCertificate.userId = certificateData.userId;
      userCertificate.contextId = certificateData.courseId;
      userCertificate.contextType = 'courses';
      userCertificate.certificateId = certificateData.certificateId;
      userCertificate.status = 'issued';
      userCertificate.issuedOn = new Date(certificateData.issuedOn);
      // Handle tenantId - use from request if available, otherwise use default
      userCertificate.tenantId =
        request?.headers?.['tenantid'] ||
        this.configService.get('TENANT_ID') ||
        'default-tenant';

      // Get templateId from course_template table using courseId
      const templateId = await this.getTemplateIdByContextId(
        certificateData.courseId,
      );

      // Get certificate_type from template table using templateId
      const certificateType = templateId
        ? await this.getCertificateTypeByTemplateId(templateId)
        : null;
      userCertificate.certificate_type = certificateType;

      // Extract user ID from JWT token - handle null request for cron jobs
      const userId = request
        ? this.extractUserIdFromRequest(request)
        : request?.headers?.['user-id'];

      userCertificate.createdBy = userId;
      userCertificate.updatedBy = userId;
      userCertificate.createdOn = new Date(); // Set current timestamp
      userCertificate.updatedOn = new Date(); // Set current timestamp

      await this.userCourseCertificateRepository.save(userCertificate);
    } catch (error) {
      this.loggerService.error(
        `Error saving user certificate: ${error.message}, userId=${certificateData.userId}, courseId=${certificateData.courseId}, certificateId=${certificateData.certificateId}`,
      );
      // Don't throw error to avoid breaking the main flow
    }
  }

  /**
   * Extract user ID from JWT token in request
   * @param request - Request object
   * @returns string - User ID or 'unknown' if not found
   */
  private extractUserIdFromRequest(request: any): string {
    let userId = request.user?.id;
    if (!userId && request.headers?.['authorization']) {
      try {
        const token = request.headers['authorization'].replace('Bearer ', '');
        // Check if token is a valid JWT format (has 3 parts separated by dots)
        if (token && token.split('.').length === 3) {
          const payload = JSON.parse(
            Buffer.from(token.split('.')[1], 'base64').toString(),
          );
          userId = payload.sub; // Extract user ID from JWT sub field
        } else {
          this.loggerService.warn('Invalid JWT token format, using fallback');
          userId = 'cron-job'; // Fallback for invalid tokens
        }
      } catch (error) {
        this.loggerService.warn('Error parsing JWT token:', error.message);
        userId = 'cron-job'; // Fallback if token parsing fails
      }
    }
    return userId || 'cron-job'; // Final fallback
  }

  /**
   * Save template record to database after successful template creation
   * @param templateData - Data from template creation
   */
  async saveTemplate(templateData: {
    templateId: string;
    templateType: string;
    title: string;
    request: any;
  }): Promise<void> {
    try {
      // Extract user ID from JWT token
      const userId = this.extractUserIdFromToken(templateData.request);
      const finalUserId = userId || 'system-user';

      // Check if template already exists for this templateId
      const existingTemplate = await this.templatesRepository.findOne({
        where: { templateId: templateData.templateId },
      });

      if (existingTemplate) {
        // Update existing record
        existingTemplate.template_type = templateData.templateType;
        existingTemplate.title = templateData.title;
        existingTemplate.updatedOn = new Date();
        existingTemplate.updatedBy = finalUserId;

        await this.templatesRepository.save(existingTemplate);
        this.loggerService.log(`Template updated: ${templateData.templateId}`);
      } else {
        // Create new record
        const template = new Templates();
        template.templatesId = randomUUID();
        template.templateId = templateData.templateId;
        template.template_type = templateData.templateType;
        template.title = templateData.title;
        template.createdOn = new Date();
        template.updatedOn = new Date();
        template.createdBy = finalUserId;
        template.updatedBy = finalUserId;

        await this.templatesRepository.save(template);
        this.loggerService.log(`Template created: ${templateData.templateId}`);
      }
    } catch (error) {
      this.loggerService.error('Error saving template:', error.message);
      // Don't throw error to avoid breaking the main flow
    }
  }

  /**
   * Get user certificates with template data
   * @param filters - Filter criteria
   * @param res - Response object
   */
  async getUserCertificates(
    filters: GetUserCertificatesDto,
    res: Response,
    options?: { excludeAcknowledgementFromResults?: boolean },
  ) {
    const apiId = 'api.get.UserCertificates';

    try {
      const {
        page,
        limit,
        userIds,
        certificateIds,
        courseIds,
        templateIds,
        certificateTypes,
      } = filters;

      const excludeAcknowledgementFromResults =
        options?.excludeAcknowledgementFromResults !== false;

      // Build query for user certificates
      let userCertQuery = this.userCourseCertificateRepository
        .createQueryBuilder('uc')
        .select([
          'uc.usercertificateId',
          'uc.userId',
          'uc.contextId',
          'uc.contextType',
          'uc.tenantId',
          'uc.certificateId',
          'uc.status',
          'uc.issuedOn',
          'uc.createdOn',
          'uc.updatedOn',
          'uc.createdBy',
          'uc.updatedBy',
          'uc.certificate_type',
          'uc.certificateUrl',
        ]);

      if (excludeAcknowledgementFromResults) {
        // POST /user-certificates (and GET user/:id): omit free acknowledgement only;
        // paid_acknowledgement is still returned. Ignored if certificateTypes requests it.
        const excludedFromUserCertificatesList = ['acknowledgement'];
        userCertQuery = userCertQuery.andWhere(
          'uc.certificate_type NOT IN (:...excludedFromUserCertificatesList)',
          { excludedFromUserCertificatesList },
        );
      }

      // Apply filters only if they are provided
      if (userIds && userIds.length > 0) {
        userCertQuery = userCertQuery.andWhere('uc.userId IN (:...userIds)', {
          userIds,
        });
      }

      if (certificateIds && certificateIds.length > 0) {
        userCertQuery = userCertQuery.andWhere(
          'uc.certificateId IN (:...certificateIds)',
          { certificateIds },
        );
      }

      if (courseIds && courseIds.length > 0) {
        userCertQuery = userCertQuery.andWhere(
          'uc.contextId IN (:...courseIds)',
          { courseIds },
        );
      }

      if (templateIds && templateIds.length > 0) {
        // Filter certificates by course context: only rows whose `contextId` has a
        // `course_templates` mapping to one of the requested `templateIds`.
        // `innerJoin` replaces a broken `WHERE ct...` without a join; `distinct(true)`
        // avoids duplicate certificate rows if the join could ever multiply matches.
        userCertQuery = userCertQuery
          .innerJoin(
            'course_templates',
            'ct',
            'ct.contextId = uc.contextId AND ct.templateId IN (:...templateIds)',
            { templateIds },
          )
          .distinct(true);
      }

      if (certificateTypes && certificateTypes.length > 0) {
        userCertQuery = userCertQuery.andWhere(
          'uc.certificate_type IN (:...certificateTypes)',
          { certificateTypes },
        );
      }

      // Get total count for pagination
      const totalCount = await userCertQuery.getCount();

      // Apply pagination only if limit is provided
      if (limit && limit > 0) {
        const currentPage = page || 1;
        const currentLimit = limit;
        const offset = (currentPage - 1) * currentLimit;

        userCertQuery = userCertQuery
          .orderBy('uc.createdOn', 'DESC')
          .offset(offset)
          .limit(currentLimit);
      } else {
        // If no limit provided, get all records but still order them
        userCertQuery = userCertQuery.orderBy('uc.createdOn', 'DESC');
      }

      const userCertificates = await userCertQuery.getRawMany();

      const contextIdList = [
        ...new Set(
          userCertificates
            .map((r) => r.uc_contextId)
            .filter((id): id is string => id != null && id !== ''),
        ),
      ];

      const courseTemplatesByContext = new Map<string, CourseTemplate[]>();
      const templateByTemplateId = new Map<string, Templates>();

      if (contextIdList.length > 0) {
        const allCourseTemplates = await this.courseTemplateRepository.find({
          where: { contextId: In(contextIdList) },
        });
        for (const ct of allCourseTemplates) {
          const list = courseTemplatesByContext.get(ct.contextId) ?? [];
          list.push(ct);
          courseTemplatesByContext.set(ct.contextId, list);
        }
        const joinedTemplateIds = [
          ...new Set(allCourseTemplates.map((c) => c.templateId)),
        ];
        if (joinedTemplateIds.length > 0) {
          const allTemplates = await this.templatesRepository.find({
            where: { templateId: In(joinedTemplateIds) },
          });
          for (const t of allTemplates) {
            templateByTemplateId.set(t.templateId, t);
          }
        }
      }

      const transformedData = userCertificates.map((record) => {
        let courseTemplate: Record<string, unknown> | null = null;
        let template: Record<string, unknown> | null = null;

        try {
          const courseTemplates =
            courseTemplatesByContext.get(record.uc_contextId) ?? [];
          for (const courseTemplateData of courseTemplates) {
            const templateData = templateByTemplateId.get(
              courseTemplateData.templateId,
            );
            if (
              templateData &&
              templateData.template_type === record.uc_certificate_type
            ) {
              courseTemplate = {
                courseTemplateId: courseTemplateData.coursetemplateId,
                templateId: courseTemplateData.templateId,
                contextId: courseTemplateData.contextId,
                createdOn: courseTemplateData.createdOn,
                updatedOn: courseTemplateData.updatedOn,
              };
              template = {
                templatesId: templateData.templatesId,
                templateId: templateData.templateId,
                template_type: templateData.template_type,
                title: templateData.title,
                createdOn: templateData.createdOn,
                updatedOn: templateData.updatedOn,
              };
              break;
            }
          }
        } catch (error) {
          this.loggerService.error(
            'Error resolving related template data:',
            error.message,
          );
        }

        return {
          usercertificateId: record.uc_usercertificateId,
          userId: record.uc_userId,
          contextId: record.uc_contextId,
          contextType: record.uc_contextType,
          tenantId: record.uc_tenantId,
          certificateId: record.uc_certificateId,
          status: record.uc_status,
          issuedOn: record.uc_issuedOn,
          createdOn: record.uc_createdOn,
          updatedOn: record.uc_updatedOn,
          createdBy: record.uc_createdBy,
          updatedBy: record.uc_updatedBy,
          certificateurl:
            record.uc_certificateurl ?? record.uc_certificateUrl ?? null,
          certificate_type: record.uc_certificate_type,
          courseTemplate,
          template,
        };
      });

      const result = {
        data: transformedData,
        pagination: {
          page: page || 1,
          limit: limit || totalCount,
          total: totalCount,
          totalPages: limit ? Math.ceil(totalCount / limit) : 1,
          hasNext: limit ? (page || 1) < Math.ceil(totalCount / limit) : false,
          hasPrev: limit ? (page || 1) > 1 : false,
        },
      };

      return APIResponse.success(
        res,
        apiId,
        result,
        HttpStatus.OK,
        'User certificates retrieved successfully',
      );
    } catch (error) {
      this.loggerService.error('Error fetching user certificates:', error);
      return APIResponse.error(
        res,
        apiId,
        'Error fetching user certificates',
        'INTERNAL_SERVER_ERROR',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Simple method to process templates for a contextId
   * @param contextId - Context ID to process
   * @param incomingTemplates - Array of incoming templates with their types
   * @param finalUserId - User ID for audit
   * @returns Object with results and errors
   */
  private async processTemplatesForContext(
    contextId: string,
    incomingTemplates: any[],
    finalUserId: string,
  ) {
    const results: any[] = [];
    const errors: any[] = [];

    try {
      this.loggerService.log(
        `Processing contextId: ${contextId} with ${incomingTemplates.length} templates`,
      );

      // Step 1: Delete all existing templates for this contextId
      const existingTemplates = await this.courseTemplateRepository.find({
        where: { contextId: contextId },
      });

      if (existingTemplates.length > 0) {
        this.loggerService.log(
          `Deleting ${existingTemplates.length} existing templates for contextId: ${contextId}`,
        );
        await this.courseTemplateRepository.remove(existingTemplates);

        for (const deleted of existingTemplates) {
          this.loggerService.log(`Deleted template: ${deleted.templateId}`);
        }
      }

      // Step 2: Create all new templates
      for (const incomingTemplate of incomingTemplates) {
        this.loggerService.log(
          `Creating new template: ${incomingTemplate.templateId} (type: ${incomingTemplate.templateType})`,
        );

        const courseTemplate = new CourseTemplate();
        courseTemplate.coursetemplateId = randomUUID();
        courseTemplate.templateId = incomingTemplate.templateId;
        courseTemplate.contextId = contextId;
        courseTemplate.createdOn = new Date();
        courseTemplate.updatedOn = new Date();
        courseTemplate.createdBy = finalUserId;
        courseTemplate.updatedBy = finalUserId;

        await this.courseTemplateRepository.save(courseTemplate);

        results.push({
          contextId: contextId,
          courseTemplateId: courseTemplate.coursetemplateId,
          templateId: incomingTemplate.templateId,
          templateType: incomingTemplate.templateType,
          action: 'created',
          status: 'success',
        });
      }

      this.loggerService.log(
        `Completed processing contextId: ${contextId} - ${existingTemplates.length} deleted, ${incomingTemplates.length} created`,
      );

      return { results, errors };
    } catch (error) {
      this.loggerService.error(
        `Error processing contextId ${contextId}:`,
        error.message,
      );
      errors.push({
        contextId: contextId,
        error: error.message,
        status: 'error',
      });
      return { results, errors };
    }
  }

  /**
   * Add course template mapping with simplified business logic for template type combinations
   * @param templateIds - Array of Template IDs
   * @param contextIds - Array of Course IDs (contextIds)
   * @param res - Response object
   * @param request - Request object
   */
  async addCourseTemplate(
    templateIds: string[],
    contextIds: string[],
    res: Response,
    request: any,
  ) {
    const apiId = 'api.add.course.template';
    try {
      // Extract user ID from JWT token
      const userId = this.extractUserIdFromToken(request);
      const finalUserId = userId || 'system-user';

      // Validate input
      if (
        !templateIds ||
        templateIds.length === 0 ||
        !contextIds ||
        contextIds.length === 0
      ) {
        this.loggerService.error(
          'Missing required parameters: templateIds or contextIds',
        );
        return APIResponse.error(
          res,
          apiId,
          'Template IDs and at least one context ID are required',
          'BAD_REQUEST',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Validate all template IDs exist and get their types
      const templateMap = new Map();
      const templateErrors: any[] = [];

      for (const templateId of templateIds) {
        try {
          const template = await this.templatesRepository.findOne({
            where: { templateId: templateId },
          });

          if (!template) {
            templateErrors.push({
              templateId: templateId,
              error: 'Template not found',
              status: 'error',
            });
            continue;
          }

          templateMap.set(templateId, {
            templateId: templateId,
            templateType: template.template_type,
          });
        } catch (templateError) {
          templateErrors.push({
            templateId: templateId,
            error: templateError.message,
            status: 'error',
          });
        }
      }

      // If any template validation failed, return error
      if (templateErrors.length > 0) {
        this.loggerService.error(
          'Template validation failed:',
          JSON.stringify(templateErrors),
        );
        return APIResponse.error(
          res,
          apiId,
          'Some templates not found or invalid',
          'NOT_FOUND',
          HttpStatus.NOT_FOUND,
        );
      }

      // Process each contextId with simple logic
      const results: any[] = [];
      const errors: any[] = [];

      for (const contextId of contextIds) {
        try {
          // Prepare incoming templates with their types
          const incomingTemplates: any[] = [];
          for (const templateId of templateIds) {
            const templateInfo = templateMap.get(templateId);
            incomingTemplates.push({
              templateId: templateId,
              templateType: templateInfo.templateType,
            });
          }

          // Process templates for this contextId (delete all existing and create new ones)
          const contextResult = await this.processTemplatesForContext(
            contextId,
            incomingTemplates,
            finalUserId,
          );

          // Add results and errors to the main arrays
          results.push(...contextResult.results);
          errors.push(...contextResult.errors);
        } catch (contextError) {
          this.loggerService.error(
            `Error processing contextId ${contextId}:`,
            contextError.message,
          );
          errors.push({
            contextId: contextId,
            error: contextError.message,
            status: 'error',
          });
        }
      }

      // Prepare response
      const successCount = results.length;
      const errorCount = errors.length;
      const totalContexts = contextIds.length;

      this.loggerService.log(
        `Processed ${totalContexts} contextIds: ${successCount} operations successful, ${errorCount} errors`,
      );

      const response = {
        templateIds: templateIds,
        contextIds: contextIds,
        summary: {
          total: totalContexts,
          successful: successCount,
          errors: errorCount,
        },
        results: results,
        errors: errors.length > 0 ? errors : undefined,
      };

      // Determine response status
      let httpStatus = HttpStatus.OK;
      let message = 'Course templates processed successfully';

      if (errorCount > 0 && successCount === 0) {
        // All failed
        httpStatus = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'Failed to process any course templates';
      } else if (errorCount > 0) {
        // Partial success
        httpStatus = HttpStatus.PARTIAL_CONTENT;
        message = `Processed ${successCount} operations across ${totalContexts} contexts successfully`;
      } else {
        // All successful
        httpStatus = HttpStatus.OK;
        message = `Successfully processed ${successCount} operations across ${totalContexts} contexts`;
      }

      return APIResponse.success(res, apiId, response, httpStatus, message);
    } catch (error) {
      this.loggerService.error('Error adding course template:', error.message);
      this.loggerService.error('Error stack:', error.stack);
      this.loggerService.error(
        'Error details:',
        JSON.stringify(
          {
            message: error.message,
            code: error.code,
            detail: error.detail,
            constraint: error.constraint,
            templateIds: templateIds,
            contextIds: contextIds,
          },
          null,
          2,
        ),
      );
      return APIResponse.error(
        res,
        apiId,
        'Error adding course template',
        'INTERNAL_SERVER_ERROR',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get template HTML by templateId from external service
   * @param templateId - Template ID
   * @param res - Response object
   */
  async getTemplate(templateId: string, res: Response) {
    const apiId = 'api.get.template';
    try {
      const url =
        this.configService.get('RC_CREDENTIAL_SCHEMA_API_BASE_URL') +
        `/template/${templateId}`;

      const response = await axios.get(url, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Fetch template details from local database
      let localTemplateData: any = null;
      let courseTemplateData: any = null;

      try {
        // Get template details from templates table
        const template = await this.templatesRepository.findOne({
          where: { templateId: templateId },
        });

        if (template) {
          localTemplateData = {
            templatesId: template.templatesId,
            templateId: template.templateId,
            template_type: template.template_type,
            title: template.title,
            createdOn: template.createdOn,
            updatedOn: template.updatedOn,
            createdBy: template.createdBy,
            updatedBy: template.updatedBy,
          };

          // Get course template data associated with this template
          const courseTemplate = await this.courseTemplateRepository.findOne({
            where: { templateId: templateId },
          });

          if (courseTemplate) {
            courseTemplateData = {
              courseTemplateId: courseTemplate.coursetemplateId,
              templateId: courseTemplate.templateId,
              contextId: courseTemplate.contextId,
              createdOn: courseTemplate.createdOn,
              updatedOn: courseTemplate.updatedOn,
              createdBy: courseTemplate.createdBy,
              updatedBy: courseTemplate.updatedBy,
            };
          }
        }
      } catch (dbError) {
        this.loggerService.error(
          'Error fetching template from local database:',
          dbError.message,
        );
      }

      if (response.data) {
        // Combine external service response with local database data
        const combinedResponse = {
          ...response.data,
          localTemplate: localTemplateData,
          courseTemplate: courseTemplateData,
        };

        return APIResponse.success(
          res,
          apiId,
          combinedResponse,
          HttpStatus.OK,
          'Template retrieved successfully',
        );
      } else {
        return APIResponse.error(
          res,
          apiId,
          'No template data found',
          'NOT_FOUND',
          HttpStatus.NOT_FOUND,
        );
      }
    } catch (error) {
      this.loggerService.error('Error fetching template:', error.message);

      if (error.response?.status === 404) {
        return APIResponse.error(
          res,
          apiId,
          'Template not found',
          'NOT_FOUND',
          HttpStatus.NOT_FOUND,
        );
      }

      return APIResponse.error(
        res,
        apiId,
        'Error fetching template',
        'INTERNAL_SERVER_ERROR',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get all templates with course template data, pagination and filtering
   * @param filters - Filter and pagination parameters
   * @param res - Response object
   */
  async getTemplates(filters: any, res: Response) {
    const apiId = 'api.get.templates';
    try {
      const {
        title,
        templateType,
        templateId,
        contextId,
        isAllocated: isAllocatedProp,
        limit,
        offset = 0,
      } = filters;
      const isAllocated =
        typeof isAllocatedProp === 'boolean'
          ? isAllocatedProp
          : typeof filters.isAllowcated === 'boolean'
            ? filters.isAllowcated
            : undefined;

      // Validate template type if provided
      if (templateType) {
        const validTemplateTypes = [
          'certificate',
          'badge',
          'acknowledgement',
          'paid_certificate',
          'paid_acknowledgement',
        ];
        const templateTypeArray = Array.isArray(templateType)
          ? templateType
          : [templateType];

        for (const type of templateTypeArray) {
          if (!validTemplateTypes.includes(type.toLowerCase())) {
            this.loggerService.error(
              `Invalid template type: ${type}. Valid types are: ${validTemplateTypes.join(
                ', ',
              )}`,
            );
            return APIResponse.error(
              res,
              apiId,
              `Invalid template type: ${type}. Valid types are: ${validTemplateTypes.join(
                ', ',
              )}`,
              'BAD_REQUEST',
              HttpStatus.BAD_REQUEST,
            );
          }
        }
      }

      // First, get templates with basic filters (without course template joins)
      let templateQuery = this.templatesRepository
        .createQueryBuilder('t')
        .select([
          't.templatesId',
          't.templateId',
          't.template_type',
          't.title',
          't.createdOn',
          't.updatedOn',
          't.createdBy',
          't.updatedBy',
        ]);

      // Apply filters
      if (title) {
        templateQuery = templateQuery.andWhere('t.title ILIKE :title', {
          title: `%${title}%`,
        });
      }

      if (templateId) {
        templateQuery = templateQuery.andWhere('t.templateId = :templateId', {
          templateId,
        });
      }

      if (templateType) {
        // Handle both single value and array for templateType filter
        if (Array.isArray(templateType)) {
          templateQuery = templateQuery.andWhere(
            't.template_type IN (:...templateType)',
            {
              templateType,
            },
          );
        } else {
          templateQuery = templateQuery.andWhere(
            't.template_type = :templateType',
            {
              templateType,
            },
          );
        }
      }

      if (typeof isAllocated === 'boolean') {
        if (isAllocated) {
          templateQuery = templateQuery.andWhere((qb) => {
            const sub = qb
              .subQuery()
              .select('1')
              .from(CourseTemplate, 'ct')
              .where('ct.templateId = t.templateId')
              .getQuery();
            return `EXISTS (${sub})`;
          });
        } else {
          templateQuery = templateQuery.andWhere((qb) => {
            const sub = qb
              .subQuery()
              .select('1')
              .from(CourseTemplate, 'ct')
              .where('ct.templateId = t.templateId')
              .getQuery();
            return `NOT EXISTS (${sub})`;
          });
        }
      }

      // Get total count for pagination (count distinct templates)
      const totalCount = await templateQuery.getCount();

      // Apply pagination only if limit is provided
      templateQuery = templateQuery.orderBy('t.createdOn', 'DESC');

      if (limit && limit > 0) {
        templateQuery = templateQuery.limit(limit).offset(offset);
      }

      const templates = await templateQuery.getRawMany();

      // Handle empty results gracefully
      if (!templates || templates.length === 0) {
        this.loggerService.log(
          `No templates found with the provided filters: ${JSON.stringify(
            filters,
          )}`,
        );

        const response = {
          templates: [],
          pagination: {
            totalCount: 0,
            totalPages: limit ? Math.ceil(0 / limit) : 1,
            currentPage: limit ? Math.floor(offset / limit) + 1 : 1,
            limit: limit || totalCount,
            offset,
            hasNext: false,
            hasPrev: offset > 0,
          },
        };

        return APIResponse.success(
          res,
          apiId,
          response,
          HttpStatus.OK,
          'No templates found matching the criteria',
        );
      }

      // Get template IDs for fetching course templates
      const templateIds = templates.map((t) => t.t_templateId);

      // Fetch course templates for these template IDs
      let courseTemplateQuery = this.courseTemplateRepository
        .createQueryBuilder('ct')
        .select([
          'ct.templateId',
          'ct.coursetemplateId',
          'ct.contextId',
          'ct.createdOn',
          'ct.updatedOn',
          'ct.createdBy',
          'ct.updatedBy',
        ])
        .where('ct.templateId IN (:...templateIds)', { templateIds });

      // Apply contextId filter if provided
      if (contextId) {
        courseTemplateQuery = courseTemplateQuery.andWhere(
          'ct.contextId = :contextId',
          { contextId },
        );
      }

      const courseTemplates = await courseTemplateQuery.getRawMany();

      // Group course templates by templateId
      const courseTemplatesByTemplate = courseTemplates.reduce((acc, ct) => {
        if (!acc[ct.ct_templateId]) {
          acc[ct.ct_templateId] = [];
        }
        acc[ct.ct_templateId].push({
          courseTemplateId: ct.ct_coursetemplateId,
          contextId: ct.ct_contextId,
          createdOn: ct.ct_createdOn,
          updatedOn: ct.ct_updatedOn,
          createdBy: ct.ct_createdBy,
          updatedBy: ct.ct_updatedBy,
        });
        return acc;
      }, {});

      // Transform the data to a more structured format
      const transformedTemplates = templates.map((template) => ({
        templatesId: template.t_templatesId,
        templateId: template.t_templateId,
        templateType: template.t_template_type,
        title: template.t_title,
        createdOn: template.t_createdOn,
        updatedOn: template.t_updatedOn,
        createdBy: template.t_createdBy,
        updatedBy: template.t_updatedBy,
        courseTemplate:
          courseTemplatesByTemplate[template.t_templateId] || null,
      }));

      // Calculate pagination info
      const effectiveLimit = limit || totalCount;
      const hasNext = limit ? offset + limit < totalCount : false;
      const hasPrev = offset > 0;
      const totalPages = limit ? Math.ceil(totalCount / limit) : 1;
      const currentPage = limit ? Math.floor(offset / limit) + 1 : 1;

      const response = {
        templates: transformedTemplates,
        pagination: {
          totalCount,
          totalPages,
          currentPage,
          limit: effectiveLimit,
          offset,
          hasNext,
          hasPrev,
        },
      };

      return APIResponse.success(
        res,
        apiId,
        response,
        HttpStatus.OK,
        'Templates retrieved successfully',
      );
    } catch (error) {
      this.loggerService.error('Error fetching templates:', error.message);
      this.loggerService.error('Error stack:', error.stack);
      this.loggerService.error(
        'Error details:',
        JSON.stringify(
          {
            message: error.message,
            code: error.code,
            detail: error.detail,
            constraint: error.constraint,
            filters: filters,
          },
          null,
          2,
        ),
      );

      // Handle specific database errors
      if (error.code === '23505') {
        // Unique constraint violation
        return APIResponse.error(
          res,
          apiId,
          'Database constraint violation',
          'CONFLICT',
          HttpStatus.CONFLICT,
        );
      }

      if (error.code === '42P01') {
        // Table doesn't exist
        return APIResponse.error(
          res,
          apiId,
          'Database table not found',
          'INTERNAL_SERVER_ERROR',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return APIResponse.error(
        res,
        apiId,
        'Error fetching templates',
        'INTERNAL_SERVER_ERROR',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get all course templates with pagination and filtering
   * @param filters - Filter and pagination parameters
   * @param res - Response object
   */
  async getCourseTemplateList(filters: any, res: Response) {
    const apiId = 'api.get.course.template.list';
    const DEFAULT_COURSE_TEMPLATE_LIMIT = 100;
    const MAX_COURSE_TEMPLATE_LIMIT = 500;
    try {
      const { contextId, templateId, offset: rawOffset = 0 } = filters;
      let limit = filters.limit;
      if (limit == null || Number(limit) <= 0) {
        limit = DEFAULT_COURSE_TEMPLATE_LIMIT;
      }
      limit = Math.min(Math.max(1, Number(limit)), MAX_COURSE_TEMPLATE_LIMIT);
      const offset = Math.max(0, Number(rawOffset) || 0);

      // Build query for course templates
      let query = this.courseTemplateRepository
        .createQueryBuilder('ct')
        .leftJoin('templates', 't', 'ct.templateId = t.templateId')
        .select([
          'ct.coursetemplateId',
          'ct.templateId',
          'ct.contextId',
          'ct.createdOn',
          'ct.updatedOn',
          'ct.createdBy',
          'ct.updatedBy',
          't.templatesId',
          't.template_type',
          't.title as title',
        ]);

      // Apply filters
      if (contextId) {
        query = query.andWhere('ct.contextId = :contextId', { contextId });
      }

      if (templateId) {
        query = query.andWhere('ct.templateId = :templateId', { templateId });
      }

      const totalCount = await query.getCount();

      query = query.orderBy('ct.createdOn', 'DESC').limit(limit).offset(offset);

      const courseTemplates = await query.getRawMany();

      // Transform the data to a more structured format
      const transformedCourseTemplates = courseTemplates.map(
        (courseTemplate) => ({
          courseTemplateId: courseTemplate.ct_coursetemplateId,
          templateId: courseTemplate.ct_templateId,
          contextId: courseTemplate.ct_contextId,
          createdOn: courseTemplate.ct_createdOn,
          updatedOn: courseTemplate.ct_updatedOn,
          createdBy: courseTemplate.ct_createdBy,
          updatedBy: courseTemplate.ct_updatedBy,
          template: courseTemplate.t_templatesId
            ? {
              templatesId: courseTemplate.t_templatesId,
              templateType: courseTemplate.t_template_type,
              title: courseTemplate.title,
            }
            : null,
        }),
      );

      const effectiveLimit = limit;
      const hasNext = offset + limit < totalCount;
      const hasPrev = offset > 0;
      const totalPages = Math.ceil(totalCount / limit) || 1;
      const currentPage = Math.floor(offset / limit) + 1;

      const response = {
        courseTemplates: transformedCourseTemplates,
        pagination: {
          totalCount,
          totalPages,
          currentPage,
          limit: effectiveLimit,
          offset,
          hasNext,
          hasPrev,
        },
      };

      this.loggerService.log(
        `Retrieved ${transformedCourseTemplates.length} course templates out of ${totalCount} total`,
      );

      return APIResponse.success(
        res,
        apiId,
        response,
        HttpStatus.OK,
        'Course templates retrieved successfully',
      );
    } catch (error) {
      this.loggerService.error(
        'Error fetching course templates:',
        error.message,
      );
      return APIResponse.error(
        res,
        apiId,
        'Error fetching course templates',
        'INTERNAL_SERVER_ERROR',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Edit/Update template via external credential service and update local database
   * @param templateId - Template ID to update
   * @param template - Template content
   * @param type - Template type (certificate or badge)
   * @param title - Template title (optional)
   * @param template_type - Template type for database (optional)
   * @param res - Response object
   */
  async editTemplate(
    templateId: string,
    template: string,
    type: string,
    title?: string,
    template_type?: string,
    res?: Response,
  ) {
    const apiId = 'api.edit.template';
    try {
      const url =
        this.configService.get('RC_CREDENTIAL_SCHEMA_API_BASE_URL') +
        `/template/${templateId}`;

      const requestBody = {
        template: template,
        type: type,
      };

      const response = await axios.put(url, requestBody, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Update local database if title or template_type is provided
      if (title || template_type) {
        try {
          const updateData: Partial<Templates> = {};

          if (title) {
            updateData.title = title;
          }

          if (template_type) {
            updateData.template_type = template_type;
          }

          // Update the template in local database
          await this.templatesRepository.update(
            { templateId: templateId },
            updateData,
          );
        } catch (dbError) {
          this.loggerService.error(
            'Error updating template in local database:',
            dbError.message,
          );
          // Continue with external service response even if database update fails
        }
      }

      // Fetch updated template data from local database to include title and template_type
      let localTemplateData: Templates | null = null;
      try {
        const localTemplate = await this.templatesRepository.findOne({
          where: { templateId: templateId },
          select: ['title', 'template_type'],
        });
        localTemplateData = localTemplate;
      } catch (dbError) {
        this.loggerService.error(
          'Error fetching updated template from local database:',
          dbError.message,
        );
      }

      // Prepare response data combining external service response with local database data
      const responseData = {
        ...response.data,
        title: localTemplateData?.title || null,
        template_type: localTemplateData?.template_type || null,
      };

      if (response.data && res) {
        return APIResponse.success(
          res,
          apiId,
          responseData,
          HttpStatus.OK,
          'Template updated successfully',
        );
      } else if (res) {
        return APIResponse.error(
          res,
          apiId,
          'No response data from external service',
          'INTERNAL_SERVER_ERROR',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      } else {
        return responseData;
      }
    } catch (error) {
      this.loggerService.error('Error updating template:', error.message);

      if (res) {
        if (error.response?.status === 404) {
          return APIResponse.error(
            res,
            apiId,
            'Template not found',
            'NOT_FOUND',
            HttpStatus.NOT_FOUND,
          );
        }

        if (error.response?.status === 400) {
          return APIResponse.error(
            res,
            apiId,
            'Invalid template data',
            'BAD_REQUEST',
            HttpStatus.BAD_REQUEST,
          );
        }

        return APIResponse.error(
          res,
          apiId,
          'Error updating template',
          'INTERNAL_SERVER_ERROR',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      } else {
        throw error;
      }
    }
  }

  /**
   * Update user auto_tags based on certificate types generated
   * @param userId - User ID to update
   * @param certificateResults - Array of certificate results with types
   * @param request - Request object for headers
   */
  private async updateUserAutoTags(
    userId: string,
    certificateResults: Array<{
      templateId: string;
      certificateType: string;
      action: string;
      certificateId: string;
    }>,
    request: any,
  ): Promise<void> {
    try {
      this.loggerService.log(`Starting auto_tags update for user ${userId}`);
      this.loggerService.log(
        `Certificate results: ${JSON.stringify(certificateResults, null, 2)}`,
      );

      // Determine which tags to add based on certificate types
      const tagsToAdd = this.determineAutoTags(certificateResults);

      if (tagsToAdd.length === 0) {
        this.loggerService.log(`No new tags to add for user ${userId}`);
        return;
      }

      this.loggerService.log(
        `Updating auto_tags for user ${userId}: ${tagsToAdd.join(', ')}`,
      );

      // Call user service update API
      await this.callUserServiceUpdateAPI(userId, tagsToAdd, request);
    } catch (error) {
      this.loggerService.error(
        `Error updating auto_tags for user ${userId}:`,
        error.message,
      );
      // Don't throw error to avoid breaking certificate issuance
    }
  }

  /**
   * Determine which auto_tags to add based on certificate types
   * @param certificateResults - Array of certificate results
   * @returns Array of tags to add
   */
  private determineAutoTags(
    certificateResults: Array<{
      templateId: string;
      certificateType: string;
      action: string;
      certificateId: string;
    }>,
  ): string[] {
    const tagsToAdd: string[] = [];
    const certificateTypes = certificateResults.map(
      (result) => result.certificateType,
    );

    // Check if badge is present
    if (certificateTypes.includes('badge')) {
      tagsToAdd.push('all_alumni');
    }

    // Check if certificate or acknowledgement is present
    if (
      certificateTypes.includes('certificate') ||
      certificateTypes.includes('acknowledgement')
    ) {
      tagsToAdd.push('completed_alumni');
    }

    this.loggerService.log(
      `Certificate types found: ${certificateTypes.join(', ')}`,
    );
    this.loggerService.log(`Tags to add: ${tagsToAdd.join(', ')}`);

    return tagsToAdd;
  }

  /**
   * Call user service update API to update auto_tags
   * @param userId - User ID to update
   * @param tagsToAdd - Array of tags to add
   * @param request - Request object for headers
   */
  private async callUserServiceUpdateAPI(
    userId: string,
    tagsToAdd: string[],
    request: any,
  ): Promise<void> {
    try {
      const userServiceUrl = this.configService.get<string>('USER_SERVICE_URL');
      if (!userServiceUrl) {
        this.loggerService.error('USER_SERVICE_URL not configured');
        return;
      }

      // Get required headers from request or environment variables
      const tenantId =
        request.headers['tenantid'] ||
        request.headers['tenant-id'] ||
        process.env.TENANT_ID ||
        'ef99949b-7f3a-4a5f-806a-e67e683e38f3';
      const academicYearId =
        request.headers['academicyearid'] ||
        request.headers['academic-year-id'] ||
        process.env.ACADEMIC_YEAR_ID ||
        '2024-25';

      if (!tenantId || !academicYearId) {
        this.loggerService.error(
          'Missing required headers for user service update',
        );
        this.loggerService.error(
          `Missing: ${!tenantId ? 'tenantId ' : ''}${!academicYearId ? 'academicYearId ' : ''
          }`,
        );
        return;
      }

      const updatePayload = {
        userData: {
          auto_tags: tagsToAdd,
        },
      };

      const cronUserId = process.env.USER_SERVICE_CRON_USER_ID || userId;

      const response = await axios.patch(
        `${userServiceUrl}/user/v1/update/${userId}?userId=${cronUserId}`,
        updatePayload,
        {
          headers: {
            'Content-Type': 'application/json',
            tenantid: tenantId,
            academicyearid: academicYearId,
            accept: 'application/json, text/plain, */*',
          },
          timeout: 30000, // 30 seconds timeout
        },
      );

      if (response.status === 200 || response.status === 201) {
        this.loggerService.log(
          `Successfully updated auto_tags for user ${userId}: ${tagsToAdd.join(
            ', ',
          )}`,
        );
      } else {
        this.loggerService.error(
          `User service update failed with status ${response.status} for user ${userId}`,
        );
      }
    } catch (error) {
      this.loggerService.error(
        `Error calling user service update API for user ${userId}:`,
        error.message,
      );
      if (error.response) {
        this.loggerService.error(
          `User service response status: ${error.response.status}`,
        );
        this.loggerService.error(
          `User service response data: ${JSON.stringify(error.response.data)}`,
        );
      }
      if (error.config) {
        this.loggerService.error(`Request URL: ${error.config.url}`);
        this.loggerService.error(`Request method: ${error.config.method}`);
      }
    }
  }

  /**
   * Fetch user details (firstName, lastName) from User Service API
   * @param userId - User ID to fetch details for
   * @param request - Request object to extract tenantId, organisationId, and academicYearId from headers
   * @returns Promise with user details (firstName, lastName) or null if failed
   */
  private async fetchUserDetailsFromUserService(
    userId: string[],
    request: any,
    limit: number = 10,
    offset: number = 0,
  ): Promise<{ firstName: string; lastName: string } | null> {
    try {
      const userServiceUrl = this.configService.get<string>('USER_SERVICE_URL');
      if (!userServiceUrl) {
        this.loggerService.error('USER_SERVICE_URL not configured');
        return null;
      }

      // Construct the User Service API endpoint
      const endpoint = '/user/v1/list';
      const url = userServiceUrl.endsWith('/')
        ? `${userServiceUrl.slice(0, -1)}${endpoint}`
        : `${userServiceUrl}${endpoint}`;

      this.loggerService.log(
        `Fetching user details from User Service: ${url} for userId: ${userId}`,
      );

      // Prepare request body with filters
      const requestBody = {
        limit: limit,
        offset: offset,
        filters: {
          userId: userId,
        },
        sort: ['name', 'asc'],
      };

      const response = await axios.post(url, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          accept: 'application/json, text/plain, */*',
        },
        timeout: 30000, // 30 seconds timeout
      });

      // Extract firstName and lastName from response
      // Response structure: result.getUserDetails[0].firstName and result.getUserDetails[0].lastName
      const getUserDetails = response.data?.result?.getUserDetails;
      if (
        getUserDetails &&
        Array.isArray(getUserDetails) &&
        getUserDetails.length > 0
      ) {
        const userData = getUserDetails[0];
        if (userData && (userData.firstName || userData.lastName)) {
          this.loggerService.log(
            `Successfully fetched user details: firstName=${userData.firstName || 'null'
            }, lastName=${userData.lastName || 'null'}`,
          );
          return {
            firstName: userData.firstName || '',
            lastName: userData.lastName || '',
          };
        } else {
          this.loggerService.warn(
            `User Service response does not contain firstName/lastName for userId: ${userId}`,
          );
          return null;
        }
      } else {
        this.loggerService.warn(
          `User Service response does not contain getUserDetails array or is empty for userId: ${userId}`,
        );
        return null;
      }
    } catch (error) {
      this.loggerService.error(
        `Error fetching user details from User Service for userId ${userId}:`,
        error.message,
      );
      if (error.response) {
        this.loggerService.error(
          `User Service API Error Response: ${JSON.stringify(
            error.response.data,
          )}`,
        );
      }
      // Return null instead of throwing to allow the process to continue
      // The calling function will handle the validation
      return null;
    }
  }

  /**
   * Get certificate URL by certificateId
   * @param certificateId - Certificate ID to search for
   * @param response - Express response object
   * @returns Promise with certificate URL or error response
   */
  async getCertificateUrlByCertificateId(
    certificateId: string,
    response: Response,
  ) {
    const apiId = 'api.get.certificate.url';
    try {
      if (!certificateId) {
        return APIResponse.error(
          response,
          apiId,
          'Certificate ID is required',
          'BAD_REQUEST',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.loggerService.log(
        `Fetching certificate URL for certificateId: ${certificateId}`,
      );

      const certificate = await this.userCourseCertificateRepository.findOne({
        where: { certificateId: certificateId },
        select: [
          'certificateUrl',
          'usercertificateId',
          'userId',
          'contextId',
          'certificate_type',
        ],
      });

      if (!certificate) {
        this.loggerService.warn(
          `Certificate not found for certificateId: ${certificateId}`,
        );
        return APIResponse.error(
          response,
          apiId,
          'Certificate not found',
          'NOT_FOUND',
          HttpStatus.NOT_FOUND,
        );
      }

      if (!certificate.certificateUrl) {
        this.loggerService.warn(
          `Certificate URL not available for certificateId: ${certificateId}`,
        );
        return APIResponse.error(
          response,
          apiId,
          'Certificate URL not available',
          'NOT_FOUND',
          HttpStatus.NOT_FOUND,
        );
      }

      this.loggerService.log(
        `Certificate URL retrieved successfully for certificateId: ${certificateId}`,
      );

      return APIResponse.success(
        response,
        apiId,
        {
          certificateId: certificateId,
          certificateUrl: certificate.certificateUrl,
          certificate_type: certificate.certificate_type,
        },
        HttpStatus.OK,
        'Certificate URL retrieved successfully',
      );
    } catch (error) {
      this.loggerService.error(
        `Error retrieving certificate URL for certificateId: ${certificateId}. Error: ${error.message}`,
      );
      if (error.stack) {
        this.loggerService.error(`Error stack: ${error.stack}`);
      }
      return APIResponse.error(
        response,
        apiId,
        'Internal server error while retrieving certificate URL',
        'INTERNAL_SERVER_ERROR',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
