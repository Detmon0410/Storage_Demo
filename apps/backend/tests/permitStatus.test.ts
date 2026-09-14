import { describe, it, expect } from "vitest";
import { computePermitStatus } from "../src/utils/permitStatus.js";

const TODAY = new Date("2026-09-11");
const DAY_MS = 86400000;

const expiryFor = (days: number) => new Date(TODAY.getTime() + days * DAY_MS);

describe("computePermitStatus", () => {
  it("returns NORMAL with 150 days remaining", () => {
    expect(computePermitStatus(expiryFor(150), TODAY)).toEqual({ daysRemaining: 150, status: "NORMAL" });
  });

  it("returns PREPARATION at exactly 120 days (boundary, inclusive)", () => {
    expect(computePermitStatus(expiryFor(120), TODAY)).toEqual({ daysRemaining: 120, status: "PREPARATION" });
  });

  it("returns NORMAL at 121 days (just outside 120 boundary)", () => {
    expect(computePermitStatus(expiryFor(121), TODAY)).toEqual({ daysRemaining: 121, status: "NORMAL" });
  });

  it("returns NOTIFY at exactly 90 days (boundary, inclusive)", () => {
    expect(computePermitStatus(expiryFor(90), TODAY)).toEqual({ daysRemaining: 90, status: "NOTIFY" });
  });

  it("returns WARNING at exactly 60 days (boundary, inclusive)", () => {
    expect(computePermitStatus(expiryFor(60), TODAY)).toEqual({ daysRemaining: 60, status: "WARNING" });
  });

  it("returns IMPORTANT_WARNING at exactly 30 days (boundary, inclusive)", () => {
    expect(computePermitStatus(expiryFor(30), TODAY)).toEqual({ daysRemaining: 30, status: "IMPORTANT_WARNING" });
  });

  it("returns WARNING at 31 days (just outside 30 boundary)", () => {
    expect(computePermitStatus(expiryFor(31), TODAY)).toEqual({ daysRemaining: 31, status: "WARNING" });
  });

  it("returns IMPORTANT_WARNING with 0 days remaining (expiry is today)", () => {
    expect(computePermitStatus(expiryFor(0), TODAY)).toEqual({ daysRemaining: 0, status: "IMPORTANT_WARNING" });
  });

  it("returns EXPIRED with -1 days remaining (expiry was yesterday)", () => {
    expect(computePermitStatus(expiryFor(-1), TODAY)).toEqual({ daysRemaining: -1, status: "EXPIRED" });
  });

  it("ignores time-of-day components (normalizes to midnight before diffing)", () => {
    const todayWithTime = new Date("2026-09-11T23:45:00");
    const expiryWithTime = new Date("2026-11-09T00:15:00"); // 59 days after 2026-09-11 midnight
    expect(computePermitStatus(expiryWithTime, todayWithTime)).toEqual({ daysRemaining: 59, status: "WARNING" });
  });
});
