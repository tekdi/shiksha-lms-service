import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";


@Module({
  imports: [
    
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return {
        type: "postgres",
        host: configService.get("DB_HOST"),
        port: configService.get("DB_PORT"),
        database: configService.get("DB_DATABASE"),
        username: configService.get("DB_USER"),
        password: configService.get("DB_PASSWORD"),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false, // Disable synchronize for production
        autoLoadEntities: true,
        migrations: [__dirname + '/../migrations/*{.ts,.js}'],
        migrationsRun: false, // Don't run migrations automatically
        migrationsTableName: 'migrations',
      };
      },
    }),
  ],
  providers: [ConfigService],
})
export class DatabaseModule {}
