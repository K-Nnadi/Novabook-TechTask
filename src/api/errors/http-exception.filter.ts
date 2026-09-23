import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AppHttpException } from './app-http.exception';
import { ErrorCode, ErrorResponseBody } from './error-code';

interface HttpRequest {
  headers: Record<string, unknown>;
}

interface HttpReply {
  status: (code: number) => { send: (body: ErrorResponseBody) => unknown };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<HttpReply>();
    const request = ctx.getRequest<HttpRequest>();
    const requestId = requestIdFrom(request);

    const body = this.toBody(exception);
    if (body.statusCode >= 500) {
      this.logger.error({
        type: 'error',
        error: body.error,
        message: body.message,
        requestId,
        stack: exception instanceof Error ? exception.stack : undefined,
      });
    } else {
      this.logger.warn({
        type: 'client_error',
        error: body.error,
        message: body.message,
        requestId,
        details: body.details,
      });
    }

    void reply.status(body.statusCode).send(body);
  }

  private toBody(exception: unknown): ErrorResponseBody {
    if (exception instanceof AppHttpException) {
      const payload = exception.getResponse();
      if (
        typeof payload === 'object' &&
        payload !== null &&
        'error' in payload
      ) {
        return payload as ErrorResponseBody;
      }
      return {
        statusCode: exception.getStatus(),
        error: exception.errorCode,
        message: exception.message,
        details: exception.details,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : typeof response === 'object' &&
              response !== null &&
              'message' in response
            ? stringifyMessage((response as { message: unknown }).message)
            : exception.message;
      return {
        statusCode: status,
        error:
          status >= 500 ? ErrorCode.INTERNAL_ERROR : ErrorCode.VALIDATION_ERROR,
        message,
        details: [],
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: ErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
      details: [],
    };
  }
}

function stringifyMessage(message: unknown): string {
  if (typeof message === 'string') {
    return message;
  }
  if (Array.isArray(message)) {
    return message.map((item) => String(item)).join('; ');
  }
  return 'Request validation failed';
}

function requestIdFrom(request: HttpRequest): string | undefined {
  const requestIdHeader = request.headers['x-request-id'];
  if (typeof requestIdHeader === 'string' && requestIdHeader.length > 0) {
    return requestIdHeader;
  }
  const trace = request.headers['x-cloud-trace-context'];
  if (typeof trace === 'string') {
    return trace.split('/')[0];
  }
  return undefined;
}
