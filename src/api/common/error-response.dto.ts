import { ApiProperty } from '@nestjs/swagger';
import { ErrorCode, ErrorDetail } from '../errors/error-code';

export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ enum: ErrorCode, example: ErrorCode.INVALID_DATE })
  error!: ErrorCode;

  @ApiProperty({ example: 'date must be a valid ISO-8601 date-time' })
  message!: string;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        field: { type: 'string' },
        issue: { type: 'string' },
      },
    },
  })
  details!: ErrorDetail[];
}
