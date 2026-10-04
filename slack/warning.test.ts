import { describe, expect, test } from "bun:test";
import {
  COUNT_PLACEHOLDER,
  DEFAULT_MESSAGE,
  hasCustomMessage,
  renderWarning,
  resolveMessage,
  usesCount,
} from "./warning";

describe("resolveMessage", () => {
  test.each([null, undefined, "", "   ", "\n\t "])(
    "uses the default message for %p",
    (message) => {
      expect(hasCustomMessage(message)).toBe(false);
      expect(resolveMessage(message)).toBe(DEFAULT_MESSAGE);
    },
  );

  test("keeps a custom message", () => {
    expect(hasCustomMessage("Please don't")).toBe(true);
    expect(resolveMessage("Please don't")).toBe("Please don't");
  });
});

describe("usesCount", () => {
  test("is true for the default message", () => {
    expect(DEFAULT_MESSAGE).toContain(COUNT_PLACEHOLDER);
    expect(usesCount(null)).toBe(true);
    expect(usesCount("  ")).toBe(true);
  });

  test("reflects whether a custom message contains the placeholder", () => {
    expect(usesCount("Pinging {count} people")).toBe(true);
    expect(usesCount("Pinging everyone")).toBe(false);
  });
});

describe("renderWarning", () => {
  test("renders the default message with the count and group mention", () => {
    expect(renderWarning(null, "S123ABC", 5)).toBe(
      `${DEFAULT_MESSAGE.replace(COUNT_PLACEHOLDER, "5")} (<!subteam^S123ABC>)`,
    );
  });

  test("uses the default message for a whitespace-only message", () => {
    expect(renderWarning("   ", "S1", 5)).toBe(renderWarning(null, "S1", 5));
  });

  test("keeps a custom message and appends the group mention", () => {
    expect(renderWarning("Think before you reply", "S123ABC", 10)).toBe(
      "Think before you reply (<!subteam^S123ABC>)",
    );
  });

  test("formats the count with thousands separators", () => {
    expect(renderWarning("{count} people", "S1", 1234)).toBe(
      "1,234 people (<!subteam^S1>)",
    );
    expect(renderWarning("{count} people", "S1", 1234567)).toBe(
      "1,234,567 people (<!subteam^S1>)",
    );
  });

  test("replaces every occurrence of the placeholder", () => {
    expect(renderWarning("{count} people, yes {count}!", "S1", 1500)).toBe(
      "1,500 people, yes 1,500! (<!subteam^S1>)",
    );
  });

  test("falls back to a generic count when the member count is unknown", () => {
    const text = renderWarning("{count} people", "S1");
    expect(text).toBe("lots of people (<!subteam^S1>)");
    expect(text).not.toContain(COUNT_PLACEHOLDER);
  });

  test("renders a count of zero rather than the fallback", () => {
    expect(renderWarning("{count} people", "S1", 0)).toBe(
      "0 people (<!subteam^S1>)",
    );
  });
});
