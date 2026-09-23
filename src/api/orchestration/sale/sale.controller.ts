import { Body, Controller, HttpCode, Patch } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../../common/error-response.dto';
import { SaleAmendmentService } from '../../modules/saleAmendment/saleAmendment.service';
import { AmendSaleDto } from './dto/amend-sale.dto';

@ApiTags('sale')
@Controller()
export class SaleController {
  constructor(private readonly saleAmendments: SaleAmendmentService) {}

  @Patch('sale')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Amend an invoice item at a point in time',
    description:
      'Accepted even if the sale or item does not exist yet. Later sales are replayed by event date.',
  })
  @ApiAcceptedResponse({ description: 'Amendment accepted' })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async amend(@Body() body: AmendSaleDto): Promise<void> {
    await this.saleAmendments.create(body);
  }
}
