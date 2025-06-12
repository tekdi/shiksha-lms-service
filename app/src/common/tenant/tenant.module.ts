import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { TenantContext } from './tenant.context';
import { TenantMiddleware } from './tenant.middleware';

@Module({
  providers: [TenantContext, TenantMiddleware],
  exports: [TenantContext],
})
export class TenantModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .forRoutes('*'); // This will apply the middleware to all routes
  }
} 