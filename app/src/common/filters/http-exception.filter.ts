import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiResponse } from '../interfaces/response.interface';
import { HelperUtil } from '../utils/helper.util';
import { Reflector } from '@nestjs/core';
import { API_ID } from '../decorators/api-id.decorator';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private reflector: Reflector) {}
  
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const errorResponse = exception.getResponse();

    // Get the apiId from the handler metadata
    const apiId = this.reflector.get<string>(API_ID, request.route?.stack[0]?.handle) || 'api.error';

    this.logger.error(
      `HTTP Exception: ${status} - ${request.method} ${request.url}`,
      errorResponse,
    );

    const responseBody: ApiResponse = {
      id: apiId,
      ver: '1.0',
      ts: new Date().toISOString(),
      params: {
        resmsgid: HelperUtil.generateMessageId(),
        status: 'failed',
        err: this.getErrorCode(status),
        errmsg: this.extractErrorMessage(errorResponse),
      },
      responseCode: status,
    };

    response.status(status).json(responseBody);
  }

  private getErrorCode(status: number): string {
    const errorCodes = {
      [HttpStatus.BAD_REQUEST]: 'ERR_BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'ERR_UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'ERR_FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'ERR_NOT_FOUND',
      [HttpStatus.CONFLICT]: 'ERR_CONFLICT',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'ERR_INTERNAL_SERVER',
    };

    return errorCodes[status] || 'ERR_UNKNOWN';
  }

  private extractErrorMessage(errorResponse: any): string {
    if (typeof errorResponse === 'string') {
      return errorResponse;
    }

    if (errorResponse && typeof errorResponse === 'object') {
      if (errorResponse.message) {
        return Array.isArray(errorResponse.message)
          ? errorResponse.message[0]
          : errorResponse.message;
      }
      if (errorResponse.error) {
        return errorResponse.error;
      }
    }

    return 'An unexpected error occurred';
  }
}