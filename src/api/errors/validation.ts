import { ValidationError } from 'class-validator';
import { AppHttpException } from './app-http.exception';
import { ErrorCode, ErrorDetail } from './error-code';

interface FlatError {
  field: string;
  constraint: string;
  message: string;
}

export function validationExceptionFactory(
  errors: ValidationError[],
): AppHttpException {
  const flat = flatten(errors, '');
  const details: ErrorDetail[] = flat.map((item) => ({
    field: item.field,
    issue: issueFromConstraint(item.constraint, item.field, item.message),
  }));
  const error = pickErrorCode(flat);
  const message = flat[0]?.message ?? 'Request validation failed';
  return new AppHttpException(400, error, message, details);
}

function flatten(errors: ValidationError[], prefix: string): FlatError[] {
  const result: FlatError[] = [];
  for (const error of errors) {
    const field = prefix ? `${prefix}.${error.property}` : error.property;
    if (error.constraints) {
      for (const [constraint, message] of Object.entries(error.constraints)) {
        result.push({ field, constraint, message });
      }
    }
    if (error.children && error.children.length > 0) {
      result.push(...flatten(error.children, field));
    }
  }
  return result;
}

function issueFromConstraint(
  constraint: string,
  field: string,
  message: string,
): string {
  if (constraint === 'isIsoDateTime') {
    return 'not_iso8601';
  }
  if (constraint === 'isNotEmpty' && fieldEndsWith(field, 'date')) {
    return 'missing';
  }
  if (constraint === 'whitelistValidation') {
    return 'unexpected_field';
  }
  if (
    (constraint === 'isIn' ||
      constraint === 'isEnum' ||
      constraint === 'equals') &&
    fieldEndsWith(field, 'eventType')
  ) {
    return 'invalid_event_type';
  }
  if (
    (constraint === 'isInt' || constraint === 'min') &&
    (fieldEndsWith(field, 'cost') || fieldEndsWith(field, 'amount'))
  ) {
    return constraint === 'isInt' ? 'not_integer_pennies' : 'negative';
  }
  if (constraint === 'min' && fieldEndsWith(field, 'taxRate')) {
    return 'negative';
  }
  return constraint || message;
}

function pickErrorCode(flat: FlatError[]): ErrorCode {
  if (flat.length === 0) {
    return ErrorCode.VALIDATION_ERROR;
  }
  const codes = new Set(flat.map((item) => codeFromFlat(item)));
  if (codes.size === 1) {
    return [...codes][0] ?? ErrorCode.VALIDATION_ERROR;
  }
  return ErrorCode.VALIDATION_ERROR;
}

function codeFromFlat(item: FlatError): ErrorCode {
  if (item.constraint === 'isIsoDateTime') {
    return ErrorCode.INVALID_DATE;
  }
  if (item.constraint === 'isNotEmpty' && fieldEndsWith(item.field, 'date')) {
    return ErrorCode.MISSING_DATE;
  }
  if (
    (item.constraint === 'isIn' ||
      item.constraint === 'isEnum' ||
      item.constraint === 'equals') &&
    fieldEndsWith(item.field, 'eventType')
  ) {
    return ErrorCode.INVALID_EVENT_TYPE;
  }
  if (
    (item.constraint === 'isInt' || item.constraint === 'min') &&
    (fieldEndsWith(item.field, 'cost') || fieldEndsWith(item.field, 'amount'))
  ) {
    return ErrorCode.INVALID_AMOUNT;
  }
  if (
    (item.constraint === 'min' || item.constraint === 'isNumber') &&
    fieldEndsWith(item.field, 'taxRate')
  ) {
    return ErrorCode.INVALID_TAX_RATE;
  }
  return ErrorCode.VALIDATION_ERROR;
}

function fieldEndsWith(field: string, suffix: string): boolean {
  return field === suffix || field.endsWith(`.${suffix}`);
}
