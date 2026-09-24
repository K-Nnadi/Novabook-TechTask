import { HttpStatus, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppHttpException } from '../../../errors/app-http.exception';
import { ErrorCode } from '../../../errors/error-code';

@Injectable()
export class HealthService {
  constructor(private readonly dataSource: DataSource) {}

  async getSummary(): Promise<{
    status: 'ok';
    database: 'up';
    timestamp: string;
  }> {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new AppHttpException(
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorCode.DATABASE_UNAVAILABLE,
        'database is unavailable',
        [{ field: 'database', issue: 'down' }],
      );
    }
    return {
      status: 'ok',
      database: 'up',
      timestamp: new Date().toISOString(),
    };
  }
}
