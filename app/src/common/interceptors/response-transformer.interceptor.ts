import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../interfaces/response.interface';
import { HelperUtil } from '../utils/helper.util';
import { Reflector } from '@nestjs/core';
import { API_ID } from '../decorators/api-id.decorator';

@Injectable()
export class ResponseTransformerInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  constructor(private reflector: Reflector) {}
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest();
    const apiId = this.reflector.get<string>(API_ID, context.getHandler()) || 'api.lms.service';
    return next.handle().pipe(
      map((data) => {
        const response: ApiResponse<T> = {
          id: apiId,  
          ver: '1.0',
          ts: new Date().toISOString(),
          params: {
            resmsgid: HelperUtil.generateMessageId(),
            status: 'successful',
            err: null,
            errmsg: null,
          },
          responseCode: context.switchToHttp().getResponse().statusCode,
          result: data,
        };
        return response;
      }),
    );
  }
}