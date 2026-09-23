export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_DATE = 'INVALID_DATE',
  INVALID_EVENT_TYPE = 'INVALID_EVENT_TYPE',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  INVALID_TAX_RATE = 'INVALID_TAX_RATE',
  MISSING_DATE = 'MISSING_DATE',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_UNAVAILABLE = 'DATABASE_UNAVAILABLE',
}

export interface ErrorDetail {
  field: string;
  issue: string;
}

export interface ErrorResponseBody {
  statusCode: number;
  error: ErrorCode;
  message: string;
  details: ErrorDetail[];
}
