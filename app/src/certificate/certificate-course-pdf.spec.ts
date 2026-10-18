import '../lessons/entities/lesson.entity';
import axios from 'axios';
import { CertificateService } from './certificate.service';
import { Course } from '../courses/entities/course.entity';
import {
  CourseTrack,
  TrackingStatus,
} from '../tracking/entities/course-track.entity';

const TENANT = 'brac';
const USER = '3129';
const COURSE_ID = '11111111-1111-4111-8111-111111111111';
const TEMPLATE_ID = 'template-1';
const CREDENTIAL_ID = 'did:rcw:credential-1';
const PDF_URL = 'https://bucket.s3.amazonaws.com/certificates/x.pdf';

const tokenFor = (sub: string) =>
  `Bearer h.${Buffer.from(JSON.stringify({ sub })).toString('base64')}.s`;

describe('CertificateService - generateCoursePdfCertificate', () => {
  let service: CertificateService;
  let repository: any;
  let manager: any;
  let queryRunner: any;
  let s3Service: any;
  let trackingService: any;
  let response: any;
  let course: any;
  let courseTrack: any;
  let existingCertificate: any;

  const request = (headers: Record<string, string> = {}) => ({
    headers: {
      tenantid: TENANT,
      authorization: tokenFor(USER),
      ...headers,
    },
  });

  const call = (dto: any = { courseId: COURSE_ID }, req: any = request()) =>
    service.generateCoursePdfCertificate(dto, req, response);

  const sentStatus = () => response.status.mock.calls[0][0];
  const sentBody = () => response.json.mock.calls[0][0];

  beforeEach(() => {
    course = {
      courseId: COURSE_ID,
      title: 'Course A',
      templateId: TEMPLATE_ID,
    };
    courseTrack = { courseTrackId: 'ct-1', status: TrackingStatus.COMPLETED };
    existingCertificate = null;

    queryRunner = {
      connect: jest.fn(),
      release: jest.fn(),
      query: jest.fn(async (sql: string) =>
        sql.includes('pg_try_advisory_lock') ? [{ locked: true }] : [],
      ),
    };
    manager = {
      findOne: jest.fn(async (entity: any) =>
        entity === Course
          ? course
          : entity === CourseTrack
            ? courseTrack
            : null,
      ),
      connection: { createQueryRunner: () => queryRunner },
    };
    repository = {
      manager,
      findOne: jest.fn(async () => existingCertificate),
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn(async (data) => data),
      update: jest.fn(),
    };
    s3Service = {
      uploadFile: jest.fn().mockResolvedValue(PDF_URL),
      extractKeyFromUrl: jest.fn(),
      deleteFile: jest.fn(),
    };
    trackingService = { updateCourseTracking: jest.fn().mockResolvedValue({}) };
    const configService = {
      get: jest.fn((key: string) =>
        key === 'RC_CREDENTIALS_API_BASE_URL' ? 'http://rc' : undefined,
      ),
    };
    const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };

    service = new CertificateService(
      repository,
      {} as any,
      {} as any,
      configService as any,
      logger as any,
      s3Service,
      trackingService,
    );
    jest
      .spyOn(service, 'getAllTemplatesByContextId')
      .mockResolvedValue([
        { templateId: TEMPLATE_ID, certificateType: 'certificate' },
      ]);
    jest
      .spyOn(service, 'getCertificateTypeByTemplateId')
      .mockResolvedValue('certificate');
    jest.spyOn(service, 'generateDidByUserId').mockResolvedValue('did:learner');
    jest
      .spyOn(service as any, 'fetchUserDetailsFromUserService')
      .mockResolvedValue({ firstName: 'Asha', lastName: 'K' });
    jest
      .spyOn(service as any, 'renderCertificatePdfBuffer')
      .mockResolvedValue(Buffer.from('%PDF'));
    jest
      .spyOn(axios, 'post')
      .mockResolvedValue({ data: { credential: { id: CREDENTIAL_ID } } });

    response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  });

  afterEach(() => jest.restoreAllMocks());

  const expectNoSideEffects = () => {
    expect(axios.post).not.toHaveBeenCalled();
    expect(s3Service.uploadFile).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
  };

  describe('validation and authorization', () => {
    it('rejects a missing tenantid header', async () => {
      await call({ courseId: COURSE_ID }, request({ tenantid: '' }));
      expect(sentStatus()).toBe(400);
      expectNoSideEffects();
    });

    it('rejects a request without a user token', async () => {
      await call({ courseId: COURSE_ID }, request({ authorization: '' }));
      expect(sentStatus()).toBe(401);
      expectNoSideEffects();
    });

    it('rejects a body userId that differs from the token user', async () => {
      await call({ courseId: COURSE_ID, userId: 'someone-else' });
      expect(sentStatus()).toBe(403);
      expect(manager.findOne).not.toHaveBeenCalled();
    });

    it('scopes the course lookup to the tenant and organisation headers', async () => {
      await call({ courseId: COURSE_ID }, request({ organisationid: 'org-1' }));
      expect(manager.findOne.mock.calls[0][1].where).toEqual({
        courseId: COURSE_ID,
        tenantId: TENANT,
        organisationId: 'org-1',
      });
      expect(manager.findOne.mock.calls[1][1].where).toEqual({
        courseId: COURSE_ID,
        userId: USER,
        tenantId: TENANT,
        organisationId: 'org-1',
      });
    });

    it('returns 404 when the course is not in the tenant', async () => {
      course = null;
      await call();
      expect(sentStatus()).toBe(404);
      expectNoSideEffects();
    });

    it('returns 403 when the course is not completed', async () => {
      courseTrack = { status: TrackingStatus.INCOMPLETE };
      await call();
      expect(sentStatus()).toBe(403);
      expectNoSideEffects();
    });

    it('returns 404 when the course has no templateId', async () => {
      course.templateId = null;
      await call();
      expect(sentStatus()).toBe(404);
      expectNoSideEffects();
    });
  });

  describe('template source', () => {
    it('uses courses.templateId by default without reading course_templates', async () => {
      await call();
      expect(service.getAllTemplatesByContextId).not.toHaveBeenCalled();
      expect((service as any).renderCertificatePdfBuffer).toHaveBeenCalledWith(
        CREDENTIAL_ID,
        TEMPLATE_ID,
      );
      expect(repository.findOne.mock.calls[0][0].where.certificate_type).toBe(
        'certificate',
      );
    });

    it('uses the template type of the course template for the certificate row', async () => {
      (service.getCertificateTypeByTemplateId as jest.Mock).mockResolvedValue(
        'Paid_Certificate',
      );
      await call();
      expect(repository.findOne.mock.calls[0][0].where.certificate_type).toBe(
        'paid_certificate',
      );
    });

    it('uses the course_templates mapping when templateSource is course_template', async () => {
      course.templateId = null;
      await call({ courseId: COURSE_ID, templateSource: 'course_template' });
      expect(service.getAllTemplatesByContextId).toHaveBeenCalledWith(
        COURSE_ID,
      );
      expect((service as any).renderCertificatePdfBuffer).toHaveBeenCalledWith(
        CREDENTIAL_ID,
        TEMPLATE_ID,
      );
      expect(sentStatus()).toBe(201);
    });

    it('returns 404 when course_templates has no template of the requested type', async () => {
      await call({
        courseId: COURSE_ID,
        templateSource: 'course_template',
        certificateType: 'badge',
      });
      expect(sentStatus()).toBe(404);
      expectNoSideEffects();
    });
  });

  describe('idempotency and concurrency', () => {
    it('returns 409 while another request holds the lock', async () => {
      queryRunner.query.mockResolvedValueOnce([{ locked: false }]);
      await call();
      expect(sentStatus()).toBe(409);
      expect(repository.findOne).not.toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('returns the stored pdfUrl without reissuing, rendering or uploading', async () => {
      existingCertificate = {
        usercertificateId: 'uc-1',
        certificateId: CREDENTIAL_ID,
        pdfUrl: PDF_URL,
      };
      await call();

      expect(sentStatus()).toBe(200);
      expect(sentBody().result).toEqual({ pdfUrl: PDF_URL });
      expect(
        (service as any).renderCertificatePdfBuffer,
      ).not.toHaveBeenCalled();
      expectNoSideEffects();
      expect(repository.findOne.mock.calls[0][0].where).toEqual({
        userId: USER,
        contextId: COURSE_ID,
        tenantId: TENANT,
        certificate_type: 'certificate',
      });
      expect(queryRunner.query).toHaveBeenCalledWith(
        'SELECT pg_advisory_unlock(hashtext($1))',
        [`certificate-pdf:${TENANT}:${USER}:${COURSE_ID}:certificate`],
      );
      expect(queryRunner.release).toHaveBeenCalled();
    });
  });

  describe('generation', () => {
    it('reuses an existing credential and stores the new PDF', async () => {
      existingCertificate = {
        usercertificateId: 'uc-1',
        certificateId: CREDENTIAL_ID,
        pdfUrl: null,
      };
      await call();

      expect(axios.post).not.toHaveBeenCalled();
      expect((service as any).renderCertificatePdfBuffer).toHaveBeenCalledWith(
        CREDENTIAL_ID,
        TEMPLATE_ID,
      );
      expect(s3Service.uploadFile).toHaveBeenCalledWith(
        expect.any(Buffer),
        `certificates/certificate-${USER}-${COURSE_ID}-did_rcw_credential-1.pdf`,
        'application/pdf',
      );
      expect(repository.update).toHaveBeenCalledWith(
        { usercertificateId: 'uc-1' },
        expect.objectContaining({ pdfUrl: PDF_URL }),
      );
      expect(sentStatus()).toBe(201);
      expect(sentBody().result).toEqual({ pdfUrl: PDF_URL });
    });

    it('issues a credential when none exists, using the course title and user-service names', async () => {
      await call();

      const payload = (axios.post as jest.Mock).mock.calls[0][1];
      expect(payload.credential.credentialSubject).toMatchObject({
        id: 'did:learner',
        firstName: 'Asha',
        lastName: 'K',
        userId: USER,
        courseId: COURSE_ID,
        courseName: 'Course A',
      });
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER,
          contextId: COURSE_ID,
          tenantId: TENANT,
          certificateId: CREDENTIAL_ID,
          certificate_type: 'certificate',
          status: 'issued',
        }),
      );
      expect(trackingService.updateCourseTracking).toHaveBeenCalledWith(
        COURSE_ID,
        USER,
        { certificateIssued: true },
        TENANT,
        undefined,
      );
      expect(s3Service.uploadFile).toHaveBeenCalled();
      expect(sentStatus()).toBe(201);
    });

    it('returns 502 when the user service cannot provide a name', async () => {
      (service as any).fetchUserDetailsFromUserService.mockResolvedValue(null);
      await call();
      expect(sentStatus()).toBe(502);
      expect(repository.save).not.toHaveBeenCalled();
      expectNoSideEffects();
    });

    it('returns 502 and saves nothing when credential issue fails', async () => {
      (axios.post as jest.Mock).mockRejectedValue(new Error('rc down'));
      await call();
      expect(sentStatus()).toBe(502);
      expect(sentBody().params.errmsg).toBe(
        'Failed to issue certificate credential',
      );
      expect(repository.save).not.toHaveBeenCalled();
      expect(s3Service.uploadFile).not.toHaveBeenCalled();
    });

    it('keeps the issued credential when rendering fails so a retry does not reissue', async () => {
      (service as any).renderCertificatePdfBuffer.mockRejectedValue(
        new Error('chromium'),
      );
      await call();
      expect(sentStatus()).toBe(502);
      expect(sentBody().params.errmsg).toBe('Failed to render certificate PDF');
      expect(repository.save).toHaveBeenCalled();
      expect(s3Service.uploadFile).not.toHaveBeenCalled();
    });

    it('returns 422 when the credentials service does not know the template', async () => {
      const rcError = Object.assign(new Error('Request failed'), {
        isAxiosError: true,
        response: { status: 400, data: { message: 'Template not found' } },
      });
      (service as any).renderCertificatePdfBuffer.mockRejectedValue(rcError);
      await call();
      expect(sentStatus()).toBe(422);
      expect(sentBody().params.errmsg).toBe(
        `Certificate template ${TEMPLATE_ID} was not found in the credentials service`,
      );
      expect(s3Service.uploadFile).not.toHaveBeenCalled();
    });

    it('returns 502 without saving a URL when the S3 upload fails', async () => {
      s3Service.uploadFile.mockRejectedValue(new Error('AccessDenied'));
      await call();
      expect(sentStatus()).toBe(502);
      expect(sentBody().params.errmsg).toBe('Failed to upload certificate PDF');
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('returns 500 when saving the PDF URL fails', async () => {
      repository.update.mockRejectedValue(new Error('db'));
      await call();
      expect(sentStatus()).toBe(500);
      expect(sentBody().params.errmsg).toBe(
        'Failed to save certificate PDF URL',
      );
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('never exposes internal error details in the response', async () => {
      s3Service.uploadFile.mockRejectedValue(
        new Error('InvalidAccessKeyId AKIA-secret'),
      );
      await call();
      expect(JSON.stringify(sentBody())).not.toContain('AKIA');
    });
  });
});
