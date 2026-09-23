import { HttpException } from '@nestjs/common';
import { ErrorCode, ErrorDetail } from './error-code';

export class AppHttpException extends HttpException {
  readonly errorCode: ErrorCode;
  readonly details: ErrorDetail[];

  constructor(
    status: number,
    errorCode: ErrorCode,
    message: string,
    details: ErrorDetail[] = [],
  ) {
    super(
      {
        statusCode: status,
        error: errorCode,
        message,
        details,
      },
      status,
    );
    this.errorCode = errorCode;
    this.details = details;
  }
}
