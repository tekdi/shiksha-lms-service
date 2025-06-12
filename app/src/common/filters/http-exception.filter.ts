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

@Catch() // Catches all exceptions
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private reflector: Reflector) {}
  
  catch(exception: unknown, host: ArgumentsHost) {
    try {
      const ctx = host.switchToHttp();
      const response = ctx.getResponse<Response>();
      const request = ctx.getRequest<Request>();
      
      // Determine status and error response
      const status = 
        exception instanceof HttpException 
          ? exception.getStatus() 
          : HttpStatus.INTERNAL_SERVER_ERROR;
      
      const errorResponse = 
        exception instanceof HttpException 
          ? exception.getResponse() 
          : exception instanceof Error
            ? exception.message
            : 'Internal server error';

      // Get the apiId from the handler metadata
      const apiId = this.getApiId(request);

      // Enhanced logging with request context
      this.logError(exception, request, status);

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
    } catch (filterError) {
      this.logger.error('Error in AllExceptionsFilter:', {
        error: filterError instanceof Error ? filterError.message : 'Unknown filter error',
        stack: filterError instanceof Error ? filterError.stack : undefined,
        timestamp: new Date().toISOString(),
      });
      
      const response = host.switchToHttp().getResponse<Response>();
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        id: 'api.error',
        ver: '1.0',
        ts: new Date().toISOString(),
        params: {
          resmsgid: HelperUtil.generateMessageId(),
          status: 'failed',
          err: 'ERR_INTERNAL_SERVER',
          errmsg: 'An unexpected error occurred while processing the API request',
        },
        responseCode: HttpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  }

  private getApiId(request: Request): string {
    try {
      // Try to get from reflector first
      const handler = request.route?.stack[0]?.handle;
      if (handler) {
        const apiId = this.reflector.get<string>(API_ID, handler);
        if (apiId) return apiId;
      }
      
      // Fallback to route path if available
      if (request.route?.path) {
        return `api${request.route.path}`.replace(/\//g, '.');
      }
      
      return 'api.error';
    } catch {
      return 'api.error';
    }
  }

  private logError(exception: unknown, request: Request, status: number) {
    const errorMessage = exception instanceof Error ? exception.message : 'Unknown error';
    const errorStack = exception instanceof Error ? exception.stack : undefined;
    
    this.logger.error(
      `Exception: ${status} - ${request.method} ${request.url}`,
      {
        error: errorMessage,
        stack: errorStack,
        timestamp: new Date().toISOString(),
        path: request.path,
        method: request.method,
        ip: request.ip,
        userAgent: request.get('user-agent'),
      },
    );
  }

  private getErrorCode(status: number): string {
    const errorCodes: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'ERR_BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'ERR_UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'ERR_FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'ERR_NOT_FOUND',
      [HttpStatus.METHOD_NOT_ALLOWED]: 'ERR_METHOD_NOT_ALLOWED',
      [HttpStatus.REQUEST_TIMEOUT]: 'ERR_REQUEST_TIMEOUT',
      [HttpStatus.CONFLICT]: 'ERR_CONFLICT',
      [HttpStatus.GONE]: 'ERR_GONE',
      [HttpStatus.PAYLOAD_TOO_LARGE]: 'ERR_PAYLOAD_TOO_LARGE',
      [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'ERR_UNSUPPORTED_MEDIA_TYPE',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'ERR_UNPROCESSABLE_ENTITY',
      [HttpStatus.TOO_MANY_REQUESTS]: 'ERR_TOO_MANY_REQUESTS',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'ERR_INTERNAL_SERVER',
      [HttpStatus.NOT_IMPLEMENTED]: 'ERR_NOT_IMPLEMENTED',
      [HttpStatus.BAD_GATEWAY]: 'ERR_BAD_GATEWAY',
      [HttpStatus.SERVICE_UNAVAILABLE]: 'ERR_SERVICE_UNAVAILABLE',
      [HttpStatus.GATEWAY_TIMEOUT]: 'ERR_GATEWAY_TIMEOUT',
    };

    return errorCodes[status] || 'ERR_UNKNOWN';
  }

  private extractErrorMessage(errorResponse: unknown): string {
    if (!errorResponse) {
      return 'An unexpected error occurred';
    }

    if (typeof errorResponse === 'string') {
      return errorResponse;
    }

    if (typeof errorResponse === 'object') {
      const errorObj = errorResponse as Record<string, any>;
      
      // Handle array of messages
      if (Array.isArray(errorObj.message)) {
        return errorObj.message[0] || 'Validation error';
      }
      
      // Handle single message
      if (errorObj.message) {
        return errorObj.message;
      }
      
      // Handle error property
      if (errorObj.error) {
        return errorObj.error;
      }
      
      // Handle validation errors
      if (errorObj.errors) {
        const firstError = Object.values(errorObj.errors)[0];
        if (typeof firstError === 'string') {
          return firstError;
        }
        if (Array.isArray(firstError)) {
          return typeof firstError[0] === 'string' ? firstError[0] : 'Validation error';
        }
        return 'Validation error';
      }
    }

    return 'An unexpected error occurred';
  }
}