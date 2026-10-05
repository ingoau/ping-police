import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  setSystemTime,
  test,
} from "bun:test";
import { clearCache, getChannelMemberCount } from "./channel-members";

const realFetch = globalThis.fetch;
const realConsoleError = console.error;

type Reply = (token: string) => unknown;
let calls: { token: string; body: FormData }[];

function mockSlack(reply: Reply) {
  globalThis.fetch = mock(async (_url: string, init: RequestInit) => {
    const body = init.body as FormData;
    const token = String(body.get("token"));
    calls.push({ token, body });
    return Response.json(reply(token));
  }) as unknown as typeof fetch;
}

const ok = (count: number) => ({
  ok: true,
  channel: { id: "C1", num_members: count },
});

beforeEach(() => {
  calls = [];
  clearCache();
  console.error = () => {};
});

afterEach(() => {
  globalThis.fetch = realFetch;
  console.error = realConsoleError;
  setSystemTime();
});

describe("getChannelMemberCount", () => {
  test("asks for the member count and caches it for 10 minutes", async () => {
    setSystemTime(new Date(Date.UTC(2026, 0, 1, 0, 0)));
    mockSlack(() => ok(42));

    expect(await getChannelMemberCount("C1")).toBe(42);
    expect(calls[0]!.body.get("include_num_members")).toBe("true");
    expect(await getChannelMemberCount("C1")).toBe(42);
    expect(calls).toHaveLength(1);

    setSystemTime(new Date(Date.UTC(2026, 0, 1, 0, 11)));
    mockSlack(() => ok(43));
    expect(await getChannelMemberCount("C1")).toBe(43);
    expect(calls).toHaveLength(2);
  });

  test("falls back to the selfbot when the bot can't see the channel", async () => {
    mockSlack((token) =>
      token.startsWith("xoxb")
        ? { ok: false, error: "channel_not_found" }
        : ok(7),
    );
    expect(await getChannelMemberCount("C1")).toBe(7);
    expect(calls.map((call) => call.token.slice(0, 4))).toEqual([
      "xoxb",
      "xoxc",
    ]);
  });

  test("shares one lookup between concurrent callers", async () => {
    mockSlack(() => ok(5));
    expect(
      await Promise.all([
        getChannelMemberCount("C1"),
        getChannelMemberCount("C1"),
      ]),
    ).toEqual([5, 5]);
    expect(calls).toHaveLength(1);
  });

  test("keeps the stale count and backs off after a failure", async () => {
    setSystemTime(new Date(Date.UTC(2026, 0, 1, 0, 0)));
    mockSlack(() => ok(42));
    await getChannelMemberCount("C1");

    setSystemTime(new Date(Date.UTC(2026, 0, 1, 0, 11)));
    mockSlack(() => ({ ok: false, error: "ratelimited" }));
    expect(await getChannelMemberCount("C1")).toBe(42);
    const failedCalls = calls.length;

    // No new calls during the backoff
    expect(await getChannelMemberCount("C1")).toBe(42);
    expect(calls).toHaveLength(failedCalls);

    setSystemTime(new Date(Date.UTC(2026, 0, 1, 0, 13)));
    mockSlack(() => ok(44));
    expect(await getChannelMemberCount("C1")).toBe(44);
  });

  test("returns undefined when there's no count to fall back on", async () => {
    mockSlack(() => ({ ok: false, error: "ratelimited" }));
    expect(await getChannelMemberCount("C1")).toBeUndefined();
  });
});
