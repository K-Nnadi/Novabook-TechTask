import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../../common/error-response.dto';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Health check including database ping' })
  @ApiOkResponse({
    schema: {
      properties: {
        status: { type: 'string', example: 'ok' },
        database: { type: 'string', example: 'up' },
        timestamp: { type: 'string' },
      },
    },
  })
  @ApiServiceUnavailableResponse({ type: ErrorResponseDto })
  async check(): Promise<{
    status: 'ok';
    database: 'up';
    timestamp: string;
  }> {
    return this.health.getSummary();
  }
}
