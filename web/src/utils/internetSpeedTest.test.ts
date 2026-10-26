import { describe, it, expect, vi, afterEach } from "vitest";
import { testInternetSpeed, DEFAULT_THRESHOLDS } from "./internetSpeedTest";

afterEach(() => vi.unstubAllGlobals());

describe("test harness", () => {
  it("loads the speed test module", () => {
    expect(DEFAULT_THRESHOLDS.minUploadMbps).toBeGreaterThan(0);
  });
});

describe("testInternetSpeed", () => {
  it("does not report an upload that meets the threshold when every endpoint fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const result = await testInternetSpeed();
    expect(result.upload).toBeLessThan(DEFAULT_THRESHOLDS.minUploadMbps);
  });

  it("does not invent a passing download speed when every measurement file fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        String(url).includes("google.com/favicon")
          ? Promise.resolve(new Response(null))
          : Promise.reject(new Error("blocked"))
      )
    );
    const result = await testInternetSpeed();
    expect(result.download).toBeLessThan(DEFAULT_THRESHOLDS.minDownloadMbps);
  });
});

describe("testInternetSpeed status", () => {
  it("marks every check as unmeasured when all requests fail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const result = await testInternetSpeed();
    expect(result.status).toBe("unmeasured");
    expect(result.passed).toBe(false);
    expect(result.checks).toEqual({ download: "unmeasured", upload: "unmeasured", ping: "unmeasured" });
  });

  it("treats non-2xx responses as unmeasured, not as a measurement", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("busy", { status: 503 })))
    );
    const result = await testInternetSpeed();
    expect(result.checks.upload).toBe("unmeasured");
    expect(result.checks.download).toBe("unmeasured");
    expect(result.status).toBe("unmeasured");
  });
});
