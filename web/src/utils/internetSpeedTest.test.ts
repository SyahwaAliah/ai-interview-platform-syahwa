import { describe, it, expect, vi, afterEach } from "vitest";
import { testInternetSpeed, DEFAULT_THRESHOLDS } from "./internetSpeedTest";

afterEach(() => vi.unstubAllGlobals());

describe("testInternetSpeed", () => {
  it("does not report an upload that meets the threshold when every endpoint fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const result = await testInternetSpeed();
    expect(result.upload).toBeLessThan(DEFAULT_THRESHOLDS.minUploadMbps);
  });
});
