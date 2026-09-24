import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../../../common/error-response.dto';
import {
  IngestSaleDto,
  IngestTaxPaymentDto,
  IngestTransactionDto,
} from './dto/ingest-transaction.dto';
import { IngestTransactionPipe } from './dto/ingest-transaction.pipe';
import { TransactionsService } from './transactions.service';

@ApiTags('transactions')
@ApiExtraModels(IngestSaleDto, IngestTaxPaymentDto, ErrorResponseDto)
@Controller()
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Post('transactions')
  @HttpCode(202)
  @ApiOperation({ summary: 'Ingest a sales or tax payment event' })
  @ApiBody({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(IngestSaleDto) },
        { $ref: getSchemaPath(IngestTaxPaymentDto) },
      ],
    },
  })
  @ApiAcceptedResponse({ description: 'Event accepted' })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async ingest(
    @Body(IngestTransactionPipe) body: IngestTransactionDto,
  ): Promise<void> {
    await this.transactions.ingest(body);
  }
}
