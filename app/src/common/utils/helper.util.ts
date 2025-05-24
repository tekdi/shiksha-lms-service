import path from 'path';
import { validationConfig } from 'src/config/file-validation.config';
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';

export class HelperUtil {
  /**
   * Generate a unique UUID
   */
  static generateUuid(): string {
    return uuidv4();
  }

  /**
   * Generate a random message ID for response
   */
  static generateMessageId(): string {
    return `msg-${Math.floor(Math.random() * 1000000)}-${Date.now()}`;
  }

  /**
   * Calculate skip value for pagination
   */
  static calculateSkip(page: number, limit: number): number {
    return (page - 1) * limit;
  }


  /**
   * Check if a string is a valid UUID
   */
  static isValidUuid(uuid: string): boolean {
    return uuidValidate(uuid);
  }

  /**
   * Check if a value is empty (null, undefined, empty string, empty array)
   */
  static isEmpty(value: any): boolean {
    if (value === null || value === undefined) {
      return true;
    }

    if (typeof value === 'string') {
      return value.trim() === '';
    }

    if (Array.isArray(value)) {
      return value.length === 0;
    }

    if (typeof value === 'object') {
      return Object.keys(value).length === 0;
    }

    return false;
  }

  /**
   * Convert string to boolean
   */
  static stringToBoolean(value: string | boolean): boolean {
    if (typeof value === 'boolean') return value;
    
    const trueValues = ['true', 'yes', '1', 'on'];
    return trueValues.includes(value.toLowerCase());
  }

  /**
   * Generate a URL-friendly alias from a title
   * @param title The title to convert to an alias
   * @returns A URL-friendly alias string
   */
  static generateAlias(title: string): string {
    if (!title) return '';
    
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-')     // Replace spaces with hyphens
      .replace(/-+/g, '-')      // Replace multiple hyphens with a single one
      .replace(/^-+|-+$/g, ''); // Remove leading and trailing hyphens
  }

  /**
   * Generate a unique alias by appending a suffix if needed
   * @param title The original title
   * @param existingAliases Array of existing aliases to check against
   * @param attempt Current attempt number (for recursion)
   * @returns A unique alias
   */
  static generateUniqueAlias(
    title: string, 
    existingAliases: string[] = [], 
    attempt: number = 0
  ): string {
    const baseAlias = this.generateAlias(title);
    
    if (attempt === 0) {
      // First attempt - try with the original title
      if (!existingAliases.includes(baseAlias)) {
        return baseAlias;
      }
    }
    
    // On second attempt, add a short timestamp or random string to make it more unique
    if (attempt === 1) {
      // Use last 5 digits of current timestamp
      const timestamp = Date.now().toString().slice(-5);
      const newAlias = `${baseAlias}-${timestamp}`;
      
      if (!existingAliases.includes(newAlias)) {
        return newAlias;
      }
    }
    
    // On third attempt, add a random string
    if (attempt === 2) {
      const randomString = Math.random().toString(36).substring(2, 6);
      const newAlias = `${baseAlias}-${randomString}`;
      
      if (!existingAliases.includes(newAlias)) {
        return newAlias;
      }
    }
    
    // After that, use a combination of timestamp and incrementing number
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const newAlias = `${baseAlias}-${timestamp}-${attempt - 2}`;
    
    if (!existingAliases.includes(newAlias)) {
      return newAlias;
    }
    
    // Recursively try with incremented attempt
    return this.generateUniqueAlias(title, existingAliases, attempt + 1);
  }

}