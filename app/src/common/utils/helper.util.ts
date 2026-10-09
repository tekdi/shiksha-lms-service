import path from 'path';
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import { Not } from 'typeorm';
import { ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { ValidationArguments } from 'class-validator';

@ValidatorConstraint({ name: 'validateDatetimeConstraints', async: false })
export class ValidateDatetimeConstraints implements ValidatorConstraintInterface {
  validate(value: string, args: ValidationArguments): boolean {
    const object = args.object as any;
    const startDateStr = object.startDate;
    const endDateStr = object.endDate;
    
    // If this field is not provided, validation passes (handled by other validators)
    if (!value) return true;
    
    // Validate date format
    const currentDate = new Date(value);
    if (isNaN(currentDate.getTime())) {
      return false;
    }
    
    // If only startDate is provided, it's valid
    if (args.property === 'startDate' && !endDateStr) {
      return true;
    }
    
    // If only endDate is provided, it's valid
    if (args.property === 'endDate' && !startDateStr) {
      return true;
    }
    
    // If both dates are provided, validate the relationship
    if (startDateStr && endDateStr) {
      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return false;
      }
      
      // endDate must be greater than startDate
      if (endDate <= startDate) {
        return false;
      }
    }
    
    return true;
  }

  defaultMessage(args: ValidationArguments) {
    if (args.property === 'startDate') {
      return 'Start date is invalid or conflicts with end date';
    }
    if (args.property === 'endDate') {
      return 'End date is invalid or must be greater than start date';
    }
    return 'Invalid datetime constraints';
  }
}

@ValidatorConstraint({ name: 'validateCertificateDateTime', async: false })
export class ValidateCertificateDateTime implements ValidatorConstraintInterface {
  validate(value: string, args: ValidationArguments): boolean {
    const object = args.object as any;
    const endDatetimeStr = object.endDatetime;
    
    // If certificate generation date is not provided, validation passes (optional field)
    if (!value) return true;
    
    // Validate date format
    const certificateDate = new Date(value);
    if (isNaN(certificateDate.getTime())) {
      return false;
    }
    
    const now = new Date();
    
    // Certificate generation date must be in the future
    if (certificateDate <= now) {
      return false;
    }
    
    // If endDatetime is provided, certificate generation date must be greater than endDatetime
    if (endDatetimeStr) {
      const endDatetime = new Date(endDatetimeStr);
      
      if (isNaN(endDatetime.getTime())) {
        return false;
      }
      
      // Certificate generation date must be greater than endDatetime
      if (certificateDate <= endDatetime) {
        return false;
      }
    }
    
    return true;
  }

  defaultMessage(args: ValidationArguments) {
    const object = args.object as any;
    const endDatetimeStr = object.endDatetime;

    if (endDatetimeStr) {
      return 'Certificate generation date must be in the future and greater than course end date';
    }
    return 'Certificate generation date must be in the future';
  }
}

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
   * Normalise a multi-value query parameter into a string array.
   * Supports comma-separated values (?ids=a,b) and repeated params (?ids=a&ids=b).
   */
  static toStringArray(value: unknown): unknown {
    if (value === undefined || value === null || value === '') return undefined;
    const values = Array.isArray(value) ? value : [value];
    return values
      .flatMap((v) => (typeof v === 'string' ? v.split(',') : [v]))
      .map((v) => (typeof v === 'string' ? v.trim() : v))
      .filter((v) => v !== '');
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

  /**
   * Safely parses JSON object strings from form-data (including escaped or wrapped quotes).
   */
  static parseJsonObject(value: any): any {
    if (value === null || value === undefined) return value;
    if (typeof value === 'object') return value;
    if (typeof value === 'string') {
      let str = value.trim();
      if (
        (str.startsWith('"') && str.endsWith('"')) ||
        (str.startsWith("'") && str.endsWith("'"))
      ) {
        str = str.slice(1, -1).trim();
      }
      str = str.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      try {
        const parsed = JSON.parse(str);
        if (typeof parsed === 'string') {
          try {
            return JSON.parse(parsed);
          } catch (_e) {
            return parsed;
          }
        }
        return parsed;
      } catch (_e) {
        try {
          return JSON.parse(value);
        } catch (_e2) {
          return value;
        }
      }
    }
    return value;
  }
}

@ValidatorConstraint({ name: 'isJsonObject', async: false })
export class IsJsonObjectConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'object' && !(value instanceof String)) return true;
    const parsed = HelperUtil.parseJsonObject(value);
    if (typeof parsed === 'object' && parsed !== null && !(parsed instanceof String)) {
      (args.object as any)[args.property] = parsed;
      return true;
    }
    return false;
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a valid JSON object`;
  }
}