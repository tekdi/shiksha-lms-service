import path from 'path';
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import { Not } from 'typeorm';

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
   * Generate a unique alias using repository pattern
   * @param title The title to convert to an alias
   * @param repository The repository to check for existing aliases
   * @param tenantId The tenant ID for data isolation
   * @param organisationId Optional organization ID for data isolation
   * @returns A unique alias
   */
  static async generateUniqueAliasWithRepo(
    title: string,
    repository: any,
    tenantId: string,
    organisationId?: string
  ): Promise<string> {
    const baseAlias = this.generateAlias(title);
    
    // First try with the original alias
    const existingWithBase = await repository.findOne({
      where: { 
        alias: baseAlias,
        tenantId,
        ...(organisationId && { organisationId })
      }
    });

    if (!existingWithBase) {
      return baseAlias;
    }

    // Try with random number
    let randomNum = Math.floor(Math.random() * 1000); // Generate random number between 0-9999
    let finalAlias = `${baseAlias}-${randomNum}`;
    
    while (true) {
      const existing = await repository.findOne({
        where: { 
          alias: finalAlias,
          tenantId,
          ...(organisationId && { organisationId })
        }
      });

      if (!existing) {
        return finalAlias;
      }

      randomNum = Math.floor(Math.random() * 1000); // Generate new random number
      finalAlias = `${baseAlias}-${randomNum}`;
    }
  }

  // Custom validator for datetime constraints
  static validateDatetimeConstraints(value: string, args: any) {
    const startDate = new Date(args.object.startDatetime);
  const endDate = new Date(value);
  const now = new Date();

  // Check if start date is in the future
  if (startDate <= now) {
    return false;
  }

  // Check if end date follows start date
  if (endDate <= startDate) {
    return false;
  }

  // Check minimum duration (1 day)
  const minDuration = 24 * 60 * 60 * 1000; // 1 day in milliseconds
  if (endDate.getTime() - startDate.getTime() < minDuration) {
    return false;
  }

  // Check maximum duration (1 year)
  const maxDuration = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
  if (endDate.getTime() - startDate.getTime() > maxDuration) {
    return false;
  }

  return true;  
}

}