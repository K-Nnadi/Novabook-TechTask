import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../../common/error-response.dto';
import { IsoDateQueryPipe } from '../../common/iso-date-query.pipe';
import { TaxPositionResponseDto } from './dto/tax-position-response.dto';
import { TaxPositionService } from './taxPosition.service';

@ApiTags('tax-position')
@Controller()
export class TaxPositionController {
  constructor(private readonly taxPositionService: TaxPositionService) {}

  @Get('tax-position')
  @ApiOperation({
    summary: 'Query tax position at a point in time',
    description:
      'Inclusive of events whose date is on or before the query date. Single-user ledger.',
  })
  @ApiQuery({
    name: 'date',
    required: true,
    example: '2024-02-22T17:29:39Z',
    description: 'Inclusive point in time (ISO-8601)',
  })
  @ApiOkResponse({ type: TaxPositionResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async getPosition(
    @Query('date', IsoDateQueryPipe) date: string,
  ): Promise<TaxPositionResponseDto> {
    return this.taxPositionService.getTaxPosition(date);
  }
}
