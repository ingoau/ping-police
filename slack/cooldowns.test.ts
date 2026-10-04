import { describe, expect, test } from "bun:test";
import { Cooldowns } from "./cooldowns";

describe("Cooldowns", () => {
  test("a key that was never started is not active", () => {
    const cooldowns = new Cooldowns(1000);
    expect(cooldowns.isActive("a", 0)).toBe(false);
    expect(cooldowns.size).toBe(0);
  });

  test("a started key is active until its ttl elapses", () => {
    const cooldowns = new Cooldowns(1000);
    cooldowns.start("a", 5000);
    expect(cooldowns.isActive("a", 5000)).toBe(true);
    expect(cooldowns.isActive("a", 5999)).toBe(true);
    expect(cooldowns.isActive("a", 6000)).toBe(false);
    expect(cooldowns.isActive("a", 7000)).toBe(false);
  });

  test("keys are independent", () => {
    const cooldowns = new Cooldowns(1000);
    cooldowns.start("a", 0);
    expect(cooldowns.isActive("a", 500)).toBe(true);
    expect(cooldowns.isActive("b", 500)).toBe(false);
  });

  test("restarting a key extends its expiry", () => {
    const cooldowns = new Cooldowns(1000);
    cooldowns.start("a", 0);
    cooldowns.start("a", 800);
    expect(cooldowns.isActive("a", 1500)).toBe(true);
    expect(cooldowns.isActive("a", 1800)).toBe(false);
    expect(cooldowns.size).toBe(1);
  });

  test("isActive does not remove expired entries", () => {
    const cooldowns = new Cooldowns(1000);
    cooldowns.start("a", 0);
    expect(cooldowns.isActive("a", 5000)).toBe(false);
    expect(cooldowns.size).toBe(1);
  });

  test("start sweeps expired entries before adding the new one", () => {
    const cooldowns = new Cooldowns(1000);
    cooldowns.start("a", 0);
    cooldowns.start("b", 500);
    cooldowns.start("c", 900);
    expect(cooldowns.size).toBe(3);

    // At 1500, "a" (expired at 1000) is gone, "b" (expires exactly at 1500)
    // is gone, "c" (expires at 1900) stays.
    cooldowns.start("d", 1500);
    expect(cooldowns.size).toBe(2);
    expect(cooldowns.isActive("c", 1500)).toBe(true);
    expect(cooldowns.isActive("d", 1500)).toBe(true);
  });

  test("sweep removes only expired entries", () => {
    const cooldowns = new Cooldowns(1000);
    cooldowns.start("a", 0);
    cooldowns.start("b", 600);
    cooldowns.sweep(999);
    expect(cooldowns.size).toBe(2);
    cooldowns.sweep(1000);
    expect(cooldowns.size).toBe(1);
    expect(cooldowns.isActive("b", 1000)).toBe(true);
    cooldowns.sweep(1600);
    expect(cooldowns.size).toBe(0);
  });

  test("defaults to the current time when now is omitted", () => {
    const cooldowns = new Cooldowns(60_000);
    cooldowns.start("a");
    expect(cooldowns.isActive("a")).toBe(true);
    expect(cooldowns.isActive("a", Date.now() + 120_000)).toBe(false);
  });
});
