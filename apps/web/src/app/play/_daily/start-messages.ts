import { errorResponseSchema } from "@greenbuild/shared";

const MESSAGES: Record<number, string> = {
  401: "Your session expired. Reload the page.",
  409: "You already have an attempt in progress. Finish it or wait for it to end.",
  503: "The sandbox service is unavailable. Try again in a moment.",
};
const UNAVAILABLE = 503;

// failureMessage explains why an attempt could not start, in the words the player needs.
export async function failureMessage(response: Response | null): Promise<string> {
  const known = MESSAGES[response?.status ?? UNAVAILABLE];
  if (known || !response) {
    return known ?? "The attempt could not start.";
  }
  const body = errorResponseSchema.safeParse(await response.json().catch(() => null));
  return body.success ? body.data.message : "The attempt could not start.";
}

