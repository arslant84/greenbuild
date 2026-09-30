import type { ErrorCode } from "@greenbuild/shared";
import { HttpStatus } from "@nestjs/common";

const STATUS_BY_CODE: Record<ErrorCode, HttpStatus> = {
  validation_failed: HttpStatus.BAD_REQUEST,
  unauthorized: HttpStatus.UNAUTHORIZED,
  forbidden: HttpStatus.FORBIDDEN,
  not_found: HttpStatus.NOT_FOUND,
  conflict: HttpStatus.CONFLICT,
  rate_limited: HttpStatus.TOO_MANY_REQUESTS,
  internal: HttpStatus.INTERNAL_SERVER_ERROR,
};

const CODE_BY_STATUS = new Map<number, ErrorCode>(
  Object.entries(STATUS_BY_CODE).map(([code, status]) => [status, code as ErrorCode]),
);

export function httpStatusFor(code: ErrorCode): HttpStatus {
  return STATUS_BY_CODE[code];
}

// Framework errors (unknown route, bad JSON body) arrive only with a status.
export function errorCodeFor(status: number): ErrorCode {
  const code = CODE_BY_STATUS.get(status);
  if (code) {
    return code;
  }
  return status >= HttpStatus.INTERNAL_SERVER_ERROR ? "internal" : "validation_failed";
}
