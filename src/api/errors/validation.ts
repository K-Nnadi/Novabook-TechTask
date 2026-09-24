import { ValidationError } from 'class-validator';
import { AppHttpException } from './app-http.exception';
import { ErrorCode, ErrorDetail } from './error-code';

interface FlatError {
  field: string;
  constraint: string;
  message: string;
}

interface MappedValidationError {
  code: ErrorCode;
  issue: string;
}

/**
 * class-validator speaks in constraint names. The API speaks in error codes.
 * The first matching rule wins. Anything else is a generic validation error.
 */
const VALIDATION_RULES: {
  appliesTo: (error: FlatError) => boolean;
  code: ErrorCode;
  issue: string | ((error: FlatError) => string);
}[] = [
  {
    appliesTo: (error) => error.constraint === 'isIsoDateTime',
    code: ErrorCode.INVALID_DATE,
    issue: 'not_iso8601',
  },
  {
    appliesTo: (error) =>
      error.constraint === 'isNotEmpty' && fieldEndsWith(error.field, 'date'),
    code: ErrorCode.MISSING_DATE,
    issue: 'missing',
  },
  {
    appliesTo: (error) => error.constraint === 'whitelistValidation',
    code: ErrorCode.VALIDATION_ERROR,
    issue: 'unexpected_field',
  },
  {
    appliesTo: (error) =>
      (error.constraint === 'isIn' ||
        error.constraint === 'isEnum' ||
        error.constraint === 'equals') &&
      fieldEndsWith(error.field, 'eventType'),
    code: ErrorCode.INVALID_EVENT_TYPE,
    issue: 'invalid_event_type',
  },
  {
    appliesTo: (error) =>
      (error.constraint === 'isInt' || error.constraint === 'min') &&
      (fieldEndsWith(error.field, 'cost') ||
        fieldEndsWith(error.field, 'amount')),
    code: ErrorCode.INVALID_AMOUNT,
    issue: (error) =>
      error.constraint === 'isInt' ? 'not_integer_pennies' : 'negative',
  },
  {
    appliesTo: (error) =>
      (error.constraint === 'min' || error.constraint === 'isNumber') &&
      fieldEndsWith(error.field, 'taxRate'),
    code: ErrorCode.INVALID_TAX_RATE,
    issue: (error) =>
      error.constraint === 'min' ? 'negative' : error.constraint,
  },
];

export function validationExceptionFactory(
  errors: ValidationError[],
): AppHttpException {
  const flat = flatten(errors, '');
  const mapped = flat.map(mapValidationError);
  const details: ErrorDetail[] = mapped.map((item, index) => ({
    field: flat[index]?.field ?? '',
    issue: item.issue,
  }));
  const message = flat[0]?.message ?? 'Request validation failed';
  return new AppHttpException(400, pickErrorCode(mapped), message, details);
}

function mapValidationError(error: FlatError): MappedValidationError {
  const rule = VALIDATION_RULES.find((candidate) => candidate.appliesTo(error));
  if (!rule) {
    return {
      code: ErrorCode.VALIDATION_ERROR,
      issue: error.constraint || error.message,
    };
  }
  return {
    code: rule.code,
    issue: typeof rule.issue === 'function' ? rule.issue(error) : rule.issue,
  };
}

function pickErrorCode(mapped: MappedValidationError[]): ErrorCode {
  const codes = new Set(mapped.map((item) => item.code));
  if (codes.size === 1) {
    return [...codes][0] ?? ErrorCode.VALIDATION_ERROR;
  }
  return ErrorCode.VALIDATION_ERROR;
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

function fieldEndsWith(field: string, suffix: string): boolean {
  return field === suffix || field.endsWith(`.${suffix}`);
}
