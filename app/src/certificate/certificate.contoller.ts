import {
  Controller,
  Post,
  Put,
  Get,
  Body,
  Res,
  Req,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiInternalServerErrorResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiCreatedResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { CertificateService } from './certificate.service';
import { CertificateCronService } from './certificate-cron.service';
import { IssueCredentialDto } from './dto/issue-certificate-dto';
import { RenderCertificateDTO } from './dto/render-certificate-dto';
import { GetUserCertificatesDto } from './dto/get-user-certificates-dto';
import { AddCourseTemplateDto } from './dto/add-course-template-dto';
import { GetTemplateDto } from './dto/get-template-dto';
import { GetTemplatesDto } from './dto/get-templates-dto';
import { CourseTemplateListDto } from './dto/course-template-list-dto';
import { EditTemplateDto } from './dto/edit-template-dto';
import { GetCertificateUrlDto } from './dto/get-certificate-url-dto';
import { RegenerateCertificatesDto } from './dto/regenerate-certificates-dto';
import { CourseCertificatePdfDto } from './dto/course-certificate-pdf-dto';

@Controller('certificate')
export class CertificateController {
  constructor(
    private readonly certificateService: CertificateService,
    private readonly certificateCronService: CertificateCronService,
  ) { }
  // API to generate DID
  @ApiOkResponse({ description: 'DID generated successfully' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  @Post('generateDid')
  async generateDid(
    @Body() createCertificateDto: any,
    @Res() response: Response,
    @Req() request: Request,
  ) {
    return this.certificateService.generateDid(
      createCertificateDto.userId,
      response,
      request,
    );
  }
  // API to create schema
  @ApiOkResponse({ description: 'Credential schema created successfully' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  @Post('schema')
  async createCredentialSchema(
    @Body() createCertificateDto: any,
    @Res() response: Response,
  ) {
    return this.certificateService.createCredentialSchema(
      createCertificateDto.schema,
      response,
    );
  }
  // API to create template
  @ApiOkResponse({ description: 'Template created successfully' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  @ApiNotFoundResponse({ description: 'Certificate Not Found.' })
  @Post('template')
  async createTemplate(
    @Body() createCertificateDto: any,
    @Res() response: Response,
    @Req() request: Request,
  ) {
    return this.certificateService.createTemplate(
      createCertificateDto.schemaId,
      createCertificateDto.template,
      createCertificateDto.title,
      createCertificateDto.template_type,
      response,
      request,
    );
  }

  // // API to issue certificate
  @ApiOkResponse({ description: 'Certificate issued successfully.' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  @Post('/issue')
  async issueCertificate(
    @Body() issueCertificateDto: IssueCredentialDto,
    @Res() response: Response,
    @Req() request: Request,
  ) {
    return await this.certificateService.issueCertificateAfterCourseCompletion(
      issueCertificateDto,
      request,
      response,
    );
  }

  // API to generate paid certificate and acknowledgement
  @ApiOkResponse({ description: 'Paid certificate and acknowledgement generated successfully.' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  @Post('/generate')
  async generatePaidCertificate(
    @Body() issueCertificateDto: IssueCredentialDto,
    @Res() response: Response,
    @Req() request: Request,
  ) {
    return await this.certificateService.issueCertificateAfterCourseCompletion(
      issueCertificateDto,
      request,
      response,
      ['paid_certificate', 'paid_acknowledgement'],
      false,
    );
  }

  @ApiOkResponse({ description: 'Certificates regenerated successfully.' })
  @ApiNotFoundResponse({ description: 'No matching certificates for user.' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  @Post('/regenerate')
  async regenerateCertificates(
    @Body() dto: RegenerateCertificatesDto,
    @Res() response: Response,
    @Req() request: Request,
  ) {
    return await this.certificateService.regenerateCertificatesForUser(
      dto,
      request,
      response,
    );
  }

  // API to render certificate
  @ApiOkResponse({ description: 'Certificate rendered successfully.' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  @Post('render')
  async renderCertificate(
    @Body() renderCertificateDto: any,
    @Res() response: Response,
  ): Promise<void> {
    await this.certificateService.renderCredentials(
      renderCertificateDto.credentialId,
      renderCertificateDto.templateId,
      response,
    );
  }
  // API to render certificate
  @ApiOkResponse({ description: 'Certificate rendered successfully.' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  @Post('render-PDF')
  async renderCertificatePDFFromHTML(
    @Body() renderCertificateDto: RenderCertificateDTO,
    @Res() response: Response,
  ): Promise<void> {
    await this.certificateService.renderPDFFromHTML(
      renderCertificateDto.credentialId,
      renderCertificateDto.templateId,
      response,
    );
  }

  // API to get user certificates with template data
  @ApiOkResponse({ description: 'User certificates retrieved successfully' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  @Post('user-certificates')
  async getUserCertificates(
    @Body() filters: GetUserCertificatesDto,
    @Res() response: Response,
  ) {
    return await this.certificateService.getUserCertificates(filters, response);
  }

  /** All certificates for a user (same payload as POST user-certificates, no pagination cap). */
  @ApiParam({ name: 'userId', description: 'User UUID', format: 'uuid' })
  @ApiOkResponse({ description: 'User certificates retrieved successfully' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  @Get('user/:userId')
  async getCertificatesByUserId(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Res() response: Response,
  ) {
    return await this.certificateService.getUserCertificates(
      { userIds: [userId] } as GetUserCertificatesDto,
      response,
    );
  }

  // API to add course template mapping for multiple context IDs
  @ApiOkResponse({ description: 'Course templates added successfully' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  @Post('course-template')
  async addCourseTemplate(
    @Body() addCourseTemplateDto: AddCourseTemplateDto,
    @Res() response: Response,
    @Req() request: Request,
  ) {
    return this.certificateService.addCourseTemplate(
      addCourseTemplateDto.templateId,
      addCourseTemplateDto.contextId,
      response,
      request,
    );
  }

  // API to get template HTML by templateId
  @ApiOkResponse({ description: 'Template retrieved successfully' })
  @ApiNotFoundResponse({ description: 'Template not found' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  @Post('get-template')
  async getTemplate(
    @Body() getTemplateDto: GetTemplateDto,
    @Res() response: Response,
  ) {
    return this.certificateService.getTemplate(
      getTemplateDto.templateId,
      response,
    );
  }

  // API to get all templates with course template data, pagination and filtering
  @ApiOkResponse({ description: 'Templates retrieved successfully' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  @Post('templates-list')
  async getTemplates(
    @Body() getTemplatesDto: GetTemplatesDto,
    @Res() response: Response,
  ) {
    return this.certificateService.getTemplates(getTemplatesDto, response);
  }

  // API to get all course templates with pagination and filtering
  @ApiOkResponse({ description: 'Course templates retrieved successfully' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  @Post('course-template/list')
  async getCourseTemplateList(
    @Body() courseTemplateListDto: CourseTemplateListDto,
    @Res() response: Response,
  ) {
    return this.certificateService.getCourseTemplateList(
      courseTemplateListDto,
      response,
    );
  }

  // API to edit/update template via external credential service
  @ApiOkResponse({ description: 'Template updated successfully' })
  @ApiNotFoundResponse({ description: 'Template not found' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @Put('edit-template')
  async editTemplate(
    @Body() editTemplateDto: EditTemplateDto,
    @Res() response: Response,
  ) {
    return this.certificateService.editTemplate(
      editTemplateDto.templateId,
      editTemplateDto.template,
      editTemplateDto.type,
      editTemplateDto.title,
      editTemplateDto.template_type,
      response,
    );
  }

  // API to manually trigger certificate issuance cron job
  @ApiOkResponse({ description: 'Certificate issuance triggered successfully' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @Post('cron/trigger')
  async triggerCertificateIssuance(
    @Res() response: Response,
    @Req() request: Request,
  ) {
    try {
      // Extract userId from query parameters (support both userId and userid)
      const userId = (request.query.userId || request.query.userid) as string;

      // Extract tenantId from headers
      const tenantId = request.headers.tenantid as string;

      // Validate required parameters
      if (!userId) {
        return response.status(400).json({
          success: false,
          message:
            'User ID not found in request. Please provide userId as query parameter.',
          executionId: null,
          totalUsers: 0,
          eligibleUsers: 0,
          processedUsers: 0,
          issuedCertificates: 0,
          skippedUsers: 0,
          errors: 0,
          duration: 0,
          timestamp: new Date().toISOString(),
        });
      }

      // Validate required headers
      if (!tenantId) {
        return response.status(400).json({
          success: false,
          message:
            'Tenant ID is required. Please provide tenantid in request headers.',
          executionId: null,
          totalUsers: 0,
          eligibleUsers: 0,
          processedUsers: 0,
          issuedCertificates: 0,
          skippedUsers: 0,
          errors: 0,
          duration: 0,
          timestamp: new Date().toISOString(),
        });
      }

      const result =
        await this.certificateCronService.triggerCertificateIssuance(userId);
      return response.status(200).json(result);
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Error triggering certificate issuance',
        executionId: null,
        totalUsers: 0,
        eligibleUsers: 0,
        processedUsers: 0,
        issuedCertificates: 0,
        skippedUsers: 0,
        errors: 1,
        duration: 0,
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    }
  }

  // API to get cron job status
  @ApiOkResponse({ description: 'Cron job status retrieved successfully' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @Get('cron/status')
  async getCronStatus(@Res() response: Response) {
    try {
      const status = this.certificateCronService.getCronStatus();
      return response.status(200).json({
        success: true,
        data: status,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return response.status(500).json({
        success: false,
        message: 'Error retrieving cron status',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // API to issue (or reuse) the caller's course certificate or module badge as a PDF stored in S3
  @ApiOkResponse({ description: 'Certificate PDF already generated' })
  @ApiCreatedResponse({ description: 'Certificate PDF generated successfully' })
  @ApiBadRequestResponse({ description: 'Invalid context or contextId' })
  @ApiUnauthorizedResponse({ description: 'User not identified from token' })
  @ApiForbiddenResponse({ description: 'Not the token user, or course/module not completed' })
  @ApiNotFoundResponse({ description: 'Course/module or its certificate/badge template not found' })
  @ApiConflictResponse({ description: 'Generation already in progress' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @Post('course-pdf')
  async generateCoursePdf(
    @Body() courseCertificatePdfDto: CourseCertificatePdfDto,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    return this.certificateService.generateCoursePdfCertificate(
      courseCertificatePdfDto,
      request,
      response,
    );
  }

  // API to get certificate URL by certificateId
  @ApiOkResponse({ description: 'Certificate URL retrieved successfully' })
  @ApiNotFoundResponse({ description: 'Certificate not found' })
  @ApiBadRequestResponse({ description: 'Bad Request.' })
  @ApiInternalServerErrorResponse({ description: 'Internal Server Error.' })
  @Post('url')
  async getCertificateUrl(
    @Body() getCertificateUrlDto: GetCertificateUrlDto,
    @Res() response: Response,
  ) {
    return await this.certificateService.getCertificateUrlByCertificateId(
      getCertificateUrlDto.certificateId,
      response,
    );
  }
}
