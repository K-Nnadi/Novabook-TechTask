import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

const ISO_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export function isIsoDateTime(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }
  if (!ISO_DATE_TIME.test(value)) {
    return false;
  }
  const ms = Date.parse(value);
  return !Number.isNaN(ms);
}

export function dateToEpoch(date: string): number {
  return Date.parse(date);
}

export function IsIsoDateTime(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isIsoDateTime',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return isIsoDateTime(value);
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must be a valid ISO-8601 date-time`;
        },
      },
    });
  };
}
