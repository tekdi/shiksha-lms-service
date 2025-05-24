
import { SetMetadata } from '@nestjs/common';

export const API_ID = 'apiId';
export const ApiId = (apiId: string) => SetMetadata(API_ID, apiId);