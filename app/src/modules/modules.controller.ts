import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  ParseUUIDPipe,
  HttpStatus,
  HttpCode,
  UseInterceptors,
  UploadedFile,
  Query,
  Patch,
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiParam, 
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ModulesService } from './modules.service';
import { API_IDS } from '../common/constants/api-ids.constant';
import { Module } from './entities/module.entity';
import { CreateModuleDto } from './dto/create-module.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { CommonQueryDto } from '../common/dto/common-query.dto';
import { ApiId } from '../common/decorators/api-id.decorator';
import { getUploadPath } from '../common/utils/upload.util';
import { uploadConfigs } from '../config/file-validation.config';
import { TenantOrg } from '../common/decorators/tenant-org.decorator';

@ApiTags('Modules')
@Controller('modules')
export class ModulesController {
  constructor(
    private readonly modulesService: ModulesService,
  ) {}

  @Post()
  @ApiId(API_IDS.CREATE_MODULE)
  @ApiOperation({ summary: 'Create a new module' })
  @ApiBody({ type: CreateModuleDto })
  @ApiResponse({ 
    status: 201, 
    description: 'Module created successfully', 
    type: Module 
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image', uploadConfigs.modules))
  async createModule(
    @Body() createModuleDto: CreateModuleDto,
    @Query() query: CommonQueryDto,
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      const imagePath = getUploadPath('module', file.filename);
      createModuleDto.image = imagePath;
    }
    const module = await this.modulesService.create(
      createModuleDto,
      query.userId,
      tenantOrg.tenantId,
      tenantOrg.organisationId,
    );
    return module;
  }

  @Get(':moduleId')
  @ApiId(API_IDS.GET_MODULE_BY_ID)
  @ApiOperation({ summary: 'Get a module by ID' })
  @ApiParam({ name: 'moduleId', type: 'string', format: 'uuid', description: 'Module ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Module retrieved successfully', 
    type: Module 
  })
  @ApiResponse({ status: 404, description: 'Module not found' })
  async getModuleById(
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string }
  ) {
    return this.modulesService.findOne(
      moduleId,
      tenantOrg.tenantId,
      tenantOrg.organisationId
    );
  }

  @Get('course/:courseId')
  @ApiId(API_IDS.GET_MODULES_BY_COURSE)
  @ApiOperation({ summary: 'Get modules by course ID' })
  @ApiParam({ name: 'courseId', type: 'string', format: 'uuid', description: 'Course ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Modules retrieved successfully',
    schema: {
      type: 'array',
      items: { $ref: '#/components/schemas/Module' }
    }
  })
  async getModulesByCourse(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string }
  ) {
    return this.modulesService.findByCourse(
      courseId,
      tenantOrg.tenantId,
      tenantOrg.organisationId
    );
  }

  @Get('parent/:parentId')
  @ApiId(API_IDS.GET_SUBMODULES_BY_PARENT)
  @ApiOperation({ summary: 'Get submodules by parent module ID' })
  @ApiParam({ name: 'parentId', type: 'string', format: 'uuid', description: 'Parent module ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Submodules retrieved successfully',
    schema: {
      type: 'array',
      items: { $ref: '#/components/schemas/Module' }
    }
  })
  async getSubmodulesByParent(
    @Param('parentId', ParseUUIDPipe) parentId: string,
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string }
  ) {
    return this.modulesService.findByParent(
      parentId,
      tenantOrg.tenantId,
      tenantOrg.organisationId
    );
  }

  @Patch(':moduleId')
  @ApiId(API_IDS.UPDATE_MODULE)
  @ApiOperation({ summary: 'Update a module' })
  @ApiBody({ type: UpdateModuleDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Module updated successfully', 
    type: Module 
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Module not found' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('image', uploadConfigs.modules))
  async updateModule(
    @Param('moduleId') moduleId: string,
    @Body() updateModuleDto: UpdateModuleDto,
    @Query() query: CommonQueryDto,
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      const imagePath = getUploadPath('module', file.filename);
      updateModuleDto.image = imagePath;
    }
    const module = await this.modulesService.update(
      moduleId,
      updateModuleDto,
      query.userId,
      tenantOrg.tenantId,
      tenantOrg.organisationId,
    );
    return module;
  }

  @Delete(':moduleId')
  @ApiId(API_IDS.DELETE_MODULE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete (archive) a module' })
  @ApiParam({ name: 'moduleId', type: 'string', format: 'uuid', description: 'Module ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Module deleted successfully',
    schema: {
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Module not found' })
  async deleteModule(
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Query() query: CommonQueryDto,
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string }
  ) {
    return this.modulesService.remove(
      moduleId,
      query.userId,
      tenantOrg.tenantId,
      tenantOrg.organisationId
    );
  }

  @Post(':moduleId/clone')
  @ApiId(API_IDS.CLONE_MODULE)
  @ApiOperation({ summary: 'Clone a module with all its lessons and submodules' })
  @ApiResponse({ 
    status: 201, 
    description: 'Module cloned successfully', 
    type: Module 
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Module not found' })
  @ApiParam({ name: 'moduleId', type: String, format: 'uuid' })
  async cloneModule(
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Query() query: CommonQueryDto,
    @TenantOrg() tenantOrg: { tenantId: string; organisationId: string }
  ) {
    return this.modulesService.cloneModule(
      moduleId,
      query.userId,
      tenantOrg.tenantId,
      tenantOrg.organisationId
    );
  }
}