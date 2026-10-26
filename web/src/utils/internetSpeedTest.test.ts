import { describe, it, expect } from "vitest";
import { DEFAULT_THRESHOLDS } from "./internetSpeedTest";

describe("test harness", () => {
  it("loads the speed test module", () => {
    expect(DEFAULT_THRESHOLDS.minUploadMbps).toBeGreaterThan(0);
  });
});
