import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  setSystemTime,
  spyOn,
  test,
} from "bun:test";
import {
  MAX_OPTIONS,
  clearCache,
  formatMemberCount,
  getGroups,
  getMemberCount,
  groupOptionLabel,
  groupOptions,
  parseGroupId,
  resolveGroup,
  searchGroups,
  type UserGroup,
} from "./usergroups";

function group(
  id: string,
  handle: string,
  name = "",
  userCount?: number,
): UserGroup {
  return { id, handle, name, userCount };
}

describe("parseGroupId", () => {
  test("accepts a raw group ID", () => {
    expect(parseGroupId("S0123ABCD")).toBe("S0123ABCD");
  });

  test("trims surrounding whitespace", () => {
    expect(parseGroupId("  S0123ABCD \n")).toBe("S0123ABCD");
  });

  test("upper-cases lowercase input", () => {
    expect(parseGroupId("s0123abcd")).toBe("S0123ABCD");
  });

  test("extracts the ID from a pasted mention", () => {
    expect(parseGroupId("<!subteam^S123ABC|@x>")).toBe("S123ABC");
    expect(parseGroupId("<!subteam^S123ABC>")).toBe("S123ABC");
    expect(parseGroupId(" <!subteam^S0123ABCD|@eng-team> ")).toBe("S0123ABCD");
  });

  test.each([
    "",
    "   ",
    "@eng",
    "U0123ABCD",
    "S12345", // too short
    "S0123-ABCD",
    "<!subteam^U123ABC|@x>",
    "<!channel>",
    "hello world",
  ])("rejects %p", (input) => {
    expect(parseGroupId(input)).toBeUndefined();
  });
});

describe("searchGroups", () => {
  const groups = [
    group("S0000001", "zeta-eng", "Engineering Zeta"),
    group("S0000002", "eng", "Core"),
    group("S0000003", "engineering", "All Engineers"),
    group("S0000004", "design", "Engineering Design"),
    group("S0000005", "platform-eng", "Platform"),
    group("S0000006", "sales", "Sales"),
  ];

  test("ranks exact > handle prefix > name prefix > handle substring > name substring", () => {
    expect(searchGroups(groups, "eng").map((g) => g.id)).toEqual([
      "S0000002", // exact handle "eng"
      "S0000003", // handle prefix "engineering"
      "S0000004", // name prefix "Engineering Design" (tie broken by handle "design")
      "S0000001", // name prefix "Engineering Zeta" (handle "zeta-eng")
      "S0000005", // handle substring "platform-eng"
    ]);
  });

  test("orders each tier as expected", () => {
    const pool = [
      group("S1000001", "xx-design", "Other"), // handle substring
      group("S1000002", "brand", "Design Team"), // name prefix
      group("S1000003", "design-ops", "Ops"), // handle prefix
      group("S1000004", "design", "Design"), // exact
      group("S1000005", "web", "Web design"), // name substring
      group("S1000006", "unrelated", "Nope"),
    ];
    expect(searchGroups(pool, "design").map((g) => g.handle)).toEqual([
      "design",
      "design-ops",
      "brand",
      "xx-design",
      "web",
    ]);
  });

  test("breaks ties within a tier by handle", () => {
    const pool = [
      group("S2000001", "eng-zeta"),
      group("S2000002", "eng-alpha"),
      group("S2000003", "eng-mid"),
    ];
    expect(searchGroups(pool, "eng").map((g) => g.handle)).toEqual([
      "eng-alpha",
      "eng-mid",
      "eng-zeta",
    ]);
  });

  test("is case-insensitive and strips a leading @", () => {
    const pool = [group("S3000001", "Design", "Design"), group("S3000002", "web")];
    expect(searchGroups(pool, "@DESIGN").map((g) => g.id)).toEqual(["S3000001"]);
    expect(searchGroups(pool, "  @design ").map((g) => g.id)).toEqual([
      "S3000001",
    ]);
  });

  test("matches by exact group ID, including pasted mentions", () => {
    expect(searchGroups(groups, "S0000006").map((g) => g.id)).toEqual([
      "S0000006",
    ]);
    expect(searchGroups(groups, "s0000006").map((g) => g.id)).toEqual([
      "S0000006",
    ]);
    expect(
      searchGroups(groups, "<!subteam^S0000006|@sales>").map((g) => g.id),
    ).toEqual(["S0000006"]);
  });

  test("returns nothing when no group matches", () => {
    expect(searchGroups(groups, "marketing")).toEqual([]);
  });

  test("an empty query returns all groups sorted by handle", () => {
    expect(searchGroups(groups, "").map((g) => g.handle)).toEqual([
      "design",
      "eng",
      "engineering",
      "platform-eng",
      "sales",
      "zeta-eng",
    ]);
    expect(searchGroups(groups, "  @ ").map((g) => g.handle)).toHaveLength(6);
  });

  test("does not mutate the input array", () => {
    const copy = [...groups];
    searchGroups(groups, "");
    searchGroups(groups, "eng");
    expect(groups).toEqual(copy);
  });

  test("respects the limit", () => {
    expect(searchGroups(groups, "", 2).map((g) => g.handle)).toEqual([
      "design",
      "eng",
    ]);
    expect(searchGroups(groups, "eng", 3)).toHaveLength(3);
  });

  test("defaults the limit to MAX_OPTIONS", () => {
    const many = Array.from({ length: 500 }, (_, i) =>
      group(`S${String(i).padStart(7, "0")}`, `team-${i}`),
    );
    expect(searchGroups(many, "")).toHaveLength(MAX_OPTIONS);
    expect(searchGroups(many, "team")).toHaveLength(MAX_OPTIONS);
  });
});

describe("formatMemberCount", () => {
  test("pluralises and formats", () => {
    expect(formatMemberCount(0)).toBe("0 members");
    expect(formatMemberCount(1)).toBe("1 member");
    expect(formatMemberCount(2)).toBe("2 members");
    expect(formatMemberCount(12345)).toBe("12,345 members");
  });
});

describe("groupOptionLabel", () => {
  test("doesn't split emoji when truncating", () => {
    const label = groupOptionLabel(
      group("S1234567", "a".repeat(69) + "🎉🎉🎉🎉", "", undefined),
    );
    expect(label.length).toBeLessThanOrEqual(75);
    expect(label.isWellFormed()).toBe(true);
    expect(label.endsWith("…")).toBe(true);
  });

  test("includes handle, name and member count", () => {
    expect(groupOptionLabel(group("S1234567", "eng", "Engineering", 42))).toBe(
      "@eng (Engineering) · 42 members",
    );
  });

  test("uses singular for one member", () => {
    expect(groupOptionLabel(group("S1234567", "eng", "Engineering", 1))).toBe(
      "@eng (Engineering) · 1 member",
    );
  });

  test("omits the name when it matches the handle or is empty", () => {
    expect(groupOptionLabel(group("S1234567", "eng", "eng"))).toBe("@eng");
    expect(groupOptionLabel(group("S1234567", "eng", ""))).toBe("@eng");
  });

  test("falls back to the ID when there is no handle", () => {
    expect(groupOptionLabel(group("S1234567", "", "", 3))).toBe(
      "@S1234567 · 3 members",
    );
  });

  test("omits the count when unknown", () => {
    expect(groupOptionLabel(group("S1234567", "eng", "Engineering"))).toBe(
      "@eng (Engineering)",
    );
  });

  test("truncates to 75 characters with an ellipsis", () => {
    const label = groupOptionLabel(
      group("S1234567", "eng", "E".repeat(200), 1000),
    );
    expect(label).toHaveLength(75);
    expect(label.endsWith("…")).toBe(true);
    expect(label.startsWith("@eng (EEE")).toBe(true);
  });

  test("does not truncate a label of exactly 75 characters", () => {
    // "@" + handle(74) = 75 chars
    const handle = "h".repeat(74);
    expect(groupOptionLabel(group("S1234567", handle))).toBe(`@${handle}`);
  });
});

describe("groupOptions", () => {
  const groups = [
    group("S0000001", "eng", "Engineering", 10),
    group("S0000002", "design", "Design", 1),
  ];

  test("maps matches to labelled options", () => {
    expect(groupOptions(groups, "eng")).toEqual([
      { text: "@eng (Engineering) · 10 members", value: "S0000001" },
    ]);
  });

  test("prepends a raw ID option when a pasted ID isn't in the list", () => {
    expect(groupOptions(groups, "S9999999")).toEqual([
      { text: "Use group ID S9999999", value: "S9999999" },
    ]);
    expect(groupOptions(groups, "<!subteam^S9999999|@new>")).toEqual([
      { text: "Use group ID S9999999", value: "S9999999" },
    ]);
  });

  test("does not duplicate an ID that is already in the list", () => {
    expect(groupOptions(groups, "S0000002")).toEqual([
      { text: "@design (Design) · 1 member", value: "S0000002" },
    ]);
    expect(groupOptions(groups, "s0000002")).toHaveLength(1);
  });

  test("offers no raw ID option for ordinary searches", () => {
    expect(groupOptions(groups, "design").map((o) => o.value)).toEqual([
      "S0000002",
    ]);
  });

  // Search words like "security" must not be mistaken for a group ID
  test("offers no raw ID option for words that merely look like IDs", () => {
    expect(groupOptions(groups, "security")).toEqual([]);
    expect(groupOptions(groups, "support")).toEqual([]);
  });

  test("never returns more than MAX_OPTIONS options with thousands of groups", () => {
    const many = Array.from({ length: 5000 }, (_, i) =>
      group(`S${String(i).padStart(7, "0")}`, `team-${i}`, `Team ${i}`, i),
    );

    expect(groupOptions(many, "")).toHaveLength(MAX_OPTIONS);
    expect(groupOptions(many, "team")).toHaveLength(MAX_OPTIONS);

    // ID not in the list: raw option first, still capped at MAX_OPTIONS
    const withRaw = groupOptions(many, "S9999999");
    expect(withRaw.length).toBeLessThanOrEqual(MAX_OPTIONS);
    expect(withRaw[0]).toEqual({
      text: "Use group ID S9999999",
      value: "S9999999",
    });

    // ID that also substring-matches lots of groups' handles/names
    const many2 = Array.from({ length: 5000 }, (_, i) =>
      group(`SX${String(i).padStart(6, "0")}`, `s9999999-${i}`),
    );
    const capped = groupOptions(many2, "S9999999");
    expect(capped).toHaveLength(MAX_OPTIONS);
    expect(capped[0]!.value).toBe("S9999999");
  });
});

// --- API-backed lookups ---------------------------------------------------

type Handler = (method: string, body: FormData) => unknown;

const realFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof mock>;
let consoleError: ReturnType<typeof spyOn>;

function mockSlack(handler: Handler) {
  fetchMock = mock(async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    expect(url.startsWith("https://slack.com/api/")).toBe(true);
    expect(init?.method).toBe("POST");
    const method = url.slice("https://slack.com/api/".length);
    const result = await handler(method, init!.body as FormData);
    return Response.json(result);
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
}

function calls(method: string) {
  return fetchMock.mock.calls.filter(([url]) =>
    String(url).endsWith(`/api/${method}`),
  ).length;
}

const listResponse = {
  ok: true,
  usergroups: [
    { id: "S0000001", handle: "eng", name: "Engineering", user_count: 12 },
    { id: "S0000002", handle: "design", name: "Design", user_count: 3 },
    { handle: "no-id", name: "Missing ID" },
  ],
};

describe("usergroups API lookups", () => {
  beforeEach(() => {
    clearCache();
    consoleError = spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    clearCache();
    setSystemTime();
    consoleError.mockRestore();
  });

  describe("getGroups", () => {
    test("fetches groups from usergroups.list with counts", async () => {
      let body: FormData | undefined;
      mockSlack((method, b) => {
        body = b;
        expect(method).toBe("usergroups.list");
        return listResponse;
      });

      const cache = await getGroups();
      expect(cache.groups).toEqual([
        { id: "S0000001", handle: "eng", name: "Engineering", userCount: 12 },
        { id: "S0000002", handle: "design", name: "Design", userCount: 3 },
      ]);
      expect(cache.byId.get("S0000002")?.handle).toBe("design");
      expect(body?.get("include_count")).toBe("true");
      expect(body?.get("include_disabled")).toBe("false");
      expect(body?.get("token")).toBe("xoxb-test");
    });

    test("defaults missing handle and name to empty strings", async () => {
      mockSlack(() => ({ ok: true, usergroups: [{ id: "S0000009" }] }));
      expect((await getGroups()).groups).toEqual([
        { id: "S0000009", handle: "", name: "", userCount: undefined },
      ]);
    });

    test("caches the result so a second call doesn't refetch", async () => {
      mockSlack(() => listResponse);
      const first = await getGroups();
      const second = await getGroups();
      expect(second).toBe(first);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test("deduplicates concurrent fetches", async () => {
      mockSlack(() => listResponse);
      const [a, b] = await Promise.all([getGroups(), getGroups()]);
      expect(a).toBe(b);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test("refetches after clearCache", async () => {
      mockSlack(() => listResponse);
      await getGroups();
      clearCache();
      await getGroups();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    test("returns a stale cache immediately and refreshes it in the background", async () => {
      setSystemTime(new Date("2026-01-01T00:00:00Z"));
      mockSlack(() => listResponse);
      const first = await getGroups();

      setSystemTime(new Date("2026-01-01T00:11:00Z"));
      mockSlack(() => ({
        ok: true,
        usergroups: [{ id: "S0000003", handle: "new" }],
      }));
      const stale = await getGroups();
      expect(stale).toBe(first);

      // let the background refresh settle
      await Bun.sleep(0);
      await Bun.sleep(0);
      const fresh = await getGroups();
      expect(fresh.groups.map((g) => g.id)).toEqual(["S0000003"]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test("doesn't retry a failed background refresh during the backoff", async () => {
      setSystemTime(new Date("2026-01-01T00:00:00Z"));
      mockSlack(() => listResponse);
      await getGroups();

      setSystemTime(new Date("2026-01-01T00:11:00Z"));
      mockSlack(() => ({ ok: false, error: "ratelimited" }));
      expect((await getGroups()).groups).toHaveLength(2);
      await Bun.sleep(0);
      await Bun.sleep(0);
      expect(calls("usergroups.list")).toBe(1);

      // Still stale, but backing off: served from cache without calling Slack
      expect((await getGroups()).groups).toHaveLength(2);
      expect(calls("usergroups.list")).toBe(1);

      setSystemTime(new Date("2026-01-01T00:12:01Z"));
      await getGroups();
      expect(calls("usergroups.list")).toBe(2);
    });

    test("throws when usergroups.list fails, backs off, then retries", async () => {
      setSystemTime(new Date("2026-01-01T00:00:00Z"));
      mockSlack(() => ({ ok: false, error: "invalid_auth" }));
      await expect(getGroups()).rejects.toThrow("invalid_auth");

      // Fails fast during the backoff without calling Slack again
      mockSlack(() => listResponse);
      await expect(getGroups()).rejects.toThrow("failed recently");
      expect(fetchMock).toHaveBeenCalledTimes(0);

      setSystemTime(new Date("2026-01-01T00:01:01Z"));
      expect((await getGroups()).groups).toHaveLength(2);
    });
  });

  describe("resolveGroup", () => {
    test("returns a cached group without calling usergroups.users.list", async () => {
      mockSlack(() => listResponse);
      expect(await resolveGroup("S0000001")).toEqual({
        id: "S0000001",
        handle: "eng",
        name: "Engineering",
        userCount: 12,
      });
      expect(calls("usergroups.users.list")).toBe(0);
    });

    test("falls back to usergroups.users.list for an uncached ID", async () => {
      let usersBody: FormData | undefined;
      mockSlack((method, body) => {
        if (method === "usergroups.list") return listResponse;
        expect(method).toBe("usergroups.users.list");
        usersBody = body;
        return { ok: true, users: ["U1", "U2", "U3", "U4"] };
      });

      expect(await resolveGroup("S0000099")).toEqual({
        id: "S0000099",
        handle: "",
        name: "",
        userCount: 4,
      });
      expect(usersBody?.get("usergroup")).toBe("S0000099");
      expect(usersBody?.get("token")).toBe("xoxb-test");
      expect(calls("usergroups.list")).toBe(1);
      expect(calls("usergroups.users.list")).toBe(1);
    });

    test("falls back to usergroups.users.list when listing groups fails", async () => {
      mockSlack((method) =>
        method === "usergroups.list"
          ? { ok: false, error: "ratelimited" }
          : { ok: true, users: ["U1"] },
      );
      expect((await resolveGroup("S0000001"))?.userCount).toBe(1);
    });

    test("falls back to the selfbot when the bot can't see the group", async () => {
      mockSlack((method, body) => {
        if (method === "usergroups.list") return listResponse;
        return body.get("token") === "xoxb-test"
          ? { ok: false, error: "no_such_subteam" }
          : { ok: true, users: ["U1", "U2"] };
      });
      expect((await resolveGroup("S0000099"))?.userCount).toBe(2);
      expect(calls("usergroups.users.list")).toBe(2);
    });

    test("returns undefined when usergroups.users.list returns ok:false", async () => {
      mockSlack((method) =>
        method === "usergroups.list"
          ? listResponse
          : { ok: false, error: "no_such_subteam" },
      );
      expect(await resolveGroup("S0000099")).toBeUndefined();
    });
  });

  describe("getMemberCount", () => {
    test("returns the cached member count", async () => {
      mockSlack(() => listResponse);
      expect(await getMemberCount("S0000002")).toBe(3);
    });

    test("returns the count from usergroups.users.list for an uncached ID", async () => {
      mockSlack((method) =>
        method === "usergroups.list"
          ? listResponse
          : { ok: true, users: ["U1", "U2"] },
      );
      expect(await getMemberCount("S0000099")).toBe(2);
    });

    test("returns undefined for an unknown group", async () => {
      mockSlack((method) =>
        method === "usergroups.list" ? listResponse : { ok: false },
      );
      expect(await getMemberCount("S0000099")).toBeUndefined();
    });

    test("returns undefined when fetch throws", async () => {
      globalThis.fetch = mock(async () => {
        throw new Error("network down");
      }) as unknown as typeof fetch;
      expect(await getMemberCount("S0000001")).toBeUndefined();
      expect(consoleError).toHaveBeenCalled();
    });
  });
});
