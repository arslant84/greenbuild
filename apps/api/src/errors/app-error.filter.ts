import { AppError, type ErrorResponse } from "@greenbuild/shared";
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { errorCodeFor, httpStatusFor } from "./http-status.js";

interface HttpError {
  status: number;
  body: ErrorResponse;
}

// Every error leaves the API in the shared {code, message, details} format.
@Catch()
export class AppErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppErrorFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { status, body } = this.toHttpError(exception);
    const response: unknown = host.switchToHttp().getResponse();
    this.adapterHost.httpAdapter.reply(response, body, status);
  }

  private toHttpError(exception: unknown): HttpError {
    if (exception instanceof AppError) {
      return { status: httpStatusFor(exception.code), body: exception.toResponse() };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return { status, body: { code: errorCodeFor(status), message: exception.message } };
    }
    // Unexpected errors are logged in full but never exposed to the client.
    this.logger.error(exception);
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { code: "internal", message: "Internal server error" },
    };
  }
}
