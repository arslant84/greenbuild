import { describe, expect, it } from "vitest";
import { AGE_NOT_CONFIRMED, AgeNotConfirmedError, AppError, ConflictError, NotFoundError, RateLimitedError, UnavailableError, ValidationError } from "./app-error.js";
import { errorResponseSchema } from "./error-response.js";

describe("AppError", () => {
  it("serializes to the shared error response format", () => {
    const error = new ValidationError("Invalid track", { field: "track" });

    const response = error.toResponse();

    expect(response).toEqual({
      code: "validation_failed",
      message: "Invalid track",
      details: { field: "track" },
    });
    expect(errorResponseSchema.parse(response)).toEqual(response);
  });

  it("omits details when none are given", () => {
    const response = new NotFoundError("Challenge not found").toResponse();

    expect(response).toEqual({ code: "not_found", message: "Challenge not found" });
    expect("details" in response).toBe(false);
  });

  it("marks a missing 16+ confirmation as forbidden with its reason", () => {
    expect(new AgeNotConfirmedError().toResponse()).toMatchObject({ code: "forbidden", details: { reason: AGE_NOT_CONFIRMED } });
  });

  it("keeps the subclass name and stays an AppError", () => {
    const error = new ConflictError("Attempt already active");

    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ConflictError");
    expect(error.code).toBe("conflict");
  });
});

describe("errorResponseSchema", () => {
  it("rejects unknown error codes", () => {
    const result = errorResponseSchema.safeParse({ code: "teapot", message: "No" });

    expect(result.success).toBe(false);
  });
});

describe("limit and dependency errors", () => {
  it.each([
    [new RateLimitedError("No checks left"), "rate_limited"],
    [new UnavailableError("The check could not run"), "unavailable"],
  ])("%s has code %s", (error, code) => {
    expect(error.toResponse()).toEqual({ code, message: error.message });
    expect(errorResponseSchema.parse(error.toResponse())).toEqual(error.toResponse());
  });
});
