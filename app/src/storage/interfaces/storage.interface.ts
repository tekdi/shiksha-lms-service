export interface PresignedUrlResponse {
  url: string;
  key: string;
  fields: Record<string, string>;
  expiresIn: number;
}

export interface FileUploadResponse {
  url: string;
  key: string;
  size: number;
  mimeType: string;
}

export interface IStorageService {
  /**
   * Get a presigned URL for direct file upload
   */
  getPresignedUrl(
    type: string,
    mimeType: string,
    fileName?: string,
  ): Promise<PresignedUrlResponse>;
  /**
   * Verify storage credentials and permissions
   */
  verifyCredentials(): Promise<boolean>;
} 