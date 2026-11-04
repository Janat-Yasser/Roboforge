import { describe, expect, it } from "vitest";
import { attachment, clientIp, createLimiter } from "../src/server/rate-limit";

describe("rate limiter", () => {
  it("allows up to max per window, then blocks, then resets", () => {
    let t = 0;
    const check = createLimiter(() => t);
    const L = { max: 3, windowMs: 1000 };
    expect([1, 2, 3].map(() => check("k", L).ok)).toEqual([true, true, true]);
    const blocked = check("k", L);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBe(1);
    expect(check("other", L).ok).toBe(true); // keys are independent
    t = 1001;
    expect(check("k", L).ok).toBe(true);
  });

  it("reads the client IP from proxy headers", () => {
    expect(clientIp(new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" } }))).toBe("1.2.3.4");
    expect(clientIp(new Request("http://x"))).toBe("local");
  });
});

describe("attachment()", () => {
  it("keeps the header valid for quotes and non-ASCII names", () => {
    const h = attachment('My "robot" ☕.zip');
    expect(h).toContain('filename="My _robot_ _.zip"');
    expect(h).toContain("filename*=UTF-8''My%20%22robot%22%20%E2%98%95.zip");
    expect(() => new Headers({ "content-disposition": h })).not.toThrow();
  });
});
