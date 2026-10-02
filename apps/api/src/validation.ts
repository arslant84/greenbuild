import { ValidationError } from "@greenbuild/shared";
import { z } from "zod";

// parseInput validates request input at the boundary and answers 400 in the shared error format.
export function parseInput<Schema extends z.ZodType>(schema: Schema, value: unknown): z.infer<Schema> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ValidationError("Invalid request", z.flattenError(result.error));
  }
  return result.data;
}
