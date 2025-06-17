import { Module, Logger } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';
import { CacheConfigService } from './cache-config.service';
import * as redisStore from 'cache-manager-redis-store';

@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger('CacheModule');
        
        const cacheEnabled = configService.get('CACHE_ENABLED') === 'true';
        
        if (!cacheEnabled) {
          logger.log('Cache is disabled, using memory store');
          return {
            ttl: configService.get('CACHE_DEFAULT_TTL', 300),
            max: configService.get('CACHE_MAX_ITEMS', 1000),
          };
        }

        try {
          const redisOptions = {
            host: configService.get('REDIS_HOST', 'localhost'),
            port: configService.get('REDIS_PORT', 6379),
            password: configService.get('REDIS_PASSWORD', ''),
            db: configService.get('REDIS_DB', 0)
          };

          logger.log('Redis store initialized successfully');
          
          return {
            store: redisStore,
            ...redisOptions,
            ttl: configService.get('CACHE_DEFAULT_TTL', 3600),
            max: configService.get('CACHE_MAX_ITEMS', 1000),
          };
        } catch (error) {
          logger.error('Failed to initialize Redis store:', error);
          throw error;
        }
      },
    }),
  ],
  providers: [CacheService, CacheConfigService],
  exports: [CacheService, CacheConfigService],
})
export class CacheModule {} 