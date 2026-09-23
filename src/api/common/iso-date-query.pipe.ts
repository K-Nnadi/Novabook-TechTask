import { Injectable, PipeTransform } from '@nestjs/common';
import { AppHttpException } from '../errors/app-http.exception';
import { ErrorCode } from '../errors/error-code';
import { isIsoDateTime } from './iso-date';

@Injectable()
export class IsoDateQueryPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    if (value === undefined || value === null || value === '') {
      throw new AppHttpException(
        400,
        ErrorCode.MISSING_DATE,
        'date query parameter is required',
        [{ field: 'date', issue: 'missing' }],
      );
    }
    if (!isIsoDateTime(value)) {
      throw new AppHttpException(
        400,
        ErrorCode.INVALID_DATE,
        'date must be a valid ISO-8601 date-time',
        [{ field: 'date', issue: 'not_iso8601' }],
      );
    }
    return value;
  }
}
