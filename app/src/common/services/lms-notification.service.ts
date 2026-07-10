import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosRequestConfig } from 'axios';

export interface NotificationPayload {
  isQueue?: boolean;
  context: string;
  key: string;
  replacements?: Record<string, string | number>;
  email: {
    recipients: string[];
  };
}

@Injectable()
export class LmsNotificationService {
  private readonly logger = new Logger(LmsNotificationService.name);
  private readonly notificationUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.notificationUrl = this.configService.get<string>('NOTIFICATION_URL', '');
  }

  async sendNotification(payload: NotificationPayload): Promise<any> {
    if (!this.notificationUrl) {
      this.logger.warn('NOTIFICATION_URL not configured — notification skipped');
      return;
    }

    const config: AxiosRequestConfig = {
      method: 'POST',
      maxBodyLength: Infinity,
      url: `${this.notificationUrl}/notification/send`,
      headers: {
        'Content-Type': 'application/json',
      },
      data: JSON.stringify(payload),
    };

    this.logger.log(`[Notification] Sending to ${config.url}`);

    try {
      const response = await axios.request(config);
      this.logger.log(`[Notification] Send response status=${response.status} data=${JSON.stringify(response.data)?.substring(0, 300)}`);
      return response.data;
    } catch (error) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        this.logger.warn(`[Notification] Notification service unavailable at ${this.notificationUrl}: ${error.message}`);
        throw new HttpException('Notification service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
      }

      if (error.response) {
        const statusCode = error.response.status;
        const responseBody = JSON.stringify(error.response.data);
        const errMsg = error.response.data?.params?.errmsg;
        this.logger.warn(`[Notification] Service returned ${statusCode}: ${responseBody}`);

        switch (statusCode) {
          case 400:
            throw new HttpException(
              `Bad Request: ${errMsg || 'Bad request'}`,
              HttpStatus.BAD_REQUEST,
            );
          case 404:
            throw new HttpException(
              `Not Found: ${errMsg || 'Resource not found'}`,
              HttpStatus.NOT_FOUND,
            );
          case 500:
            throw new HttpException(
              `Internal Server Error: ${errMsg || 'Internal server error'}`,
              HttpStatus.INTERNAL_SERVER_ERROR,
            );
          default:
            throw new HttpException(
              `Unexpected Error: ${errMsg || 'Unexpected error'}`,
              HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
      }

      this.logger.warn(`[Notification] Failed to send notification: ${error.message}`);
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
