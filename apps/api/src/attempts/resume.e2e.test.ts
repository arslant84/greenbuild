import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { player, useAttemptsApp } from "../testing/attempts-app.js";
import { NGINX_502, readyAttempt, startedBy } from "../testing/engine-status.js";

// architecture.md, task 21a: a player who left the sandbox screen can find their running attempt again.
const app = useAttemptsApp();

describe("finding the running attempt", () => {
  it("names it when a second start is refused", async () => {
    const user = await player(app, randomUUID());
    const { id } = await startedBy(user);

    const second = await user.start(NGINX_502);
    expect(second.status).toBe(409);
    expect(await second.json()).toMatchObject({ code: "conflict", details: { active_attempt_id: id } });
  });

  it("lists it with a fresh attach token while the sandbox is ready", async () => {
    const user = await player(app, randomUUID());
    const id = await readyAttempt(app, user);

    const response = await user.list("?status=active");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { attempts: { id: string; status: string; attach_token?: string }[] };
    expect(body.attempts).toMatchObject([{ id, status: "ready" }]);
    expect(body.attempts[0]?.attach_token).toEqual(expect.any(String));
  });

  it("lists nothing once the attempt is over", async () => {
    const user = await player(app, randomUUID());
    const id = await readyAttempt(app, user);
    await user.abandon(id);

    expect(await (await user.list("?status=active")).json()).toEqual({ attempts: [] });
  });
});

describe("listing attempts refuses", () => {
  it("another user's attempt by listing nothing", async () => {
    await startedBy(await player(app, randomUUID()));

    expect(await (await (await player(app, randomUUID())).list("?status=active")).json()).toEqual({ attempts: [] });
  });

  it.each([
    ["no status filter", ""],
    ["an unknown status filter", "?status=solved"],
  ])("%s with 400", async (_name, query) => {
    expect((await (await player(app, randomUUID())).list(query)).status).toBe(400);
  });
});
