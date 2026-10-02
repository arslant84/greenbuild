import { describe, expect, it } from "vitest";
import { failureMessage } from "./start-messages";

describe("failureMessage", () => {
  it.each([
    [409, "You already have an attempt in progress. Finish it or wait for it to end."],
    [401, "Your session expired. Reload the page."],
    [503, "The sandbox service is unavailable. Try again in a moment."],
  ])("explains %d", async (status, message) => {
    expect(await failureMessage(new Response("{}", { status }))).toBe(message);
  });

  it("passes the API's own message through for other errors", async () => {
    const response = Response.json({ code: "not_found", message: "Challenge not found" }, { status: 404 });

    expect(await failureMessage(response)).toBe("Challenge not found");
  });

  it("treats an unreachable server as unavailable", async () => {
    expect(await failureMessage(null)).toBe("The sandbox service is unavailable. Try again in a moment.");
  });
});
