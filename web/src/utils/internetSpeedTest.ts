// Internet Speed Test Utilities — standalone, no backend dependency

export type CheckStatus = "ok" | "slow" | "unmeasured";
export type ReadinessStatus = "pass" | "warn" | "unmeasured";

export interface InternetSpeedResult {
    download: number;
    upload: number;
    ping: number;
    passed: boolean;
    /** "unmeasured" means at least one check could not be measured; it is never reported as a pass. */
    status: ReadinessStatus;
    checks: { download: CheckStatus; upload: CheckStatus; ping: CheckStatus };
    downloadTests: number[];
    uploadTests: number[];
    pingTests: number[];
}

export interface SpeedThresholds {
    minDownloadMbps: number;
    minUploadMbps: number;
    maxPingMs: number;
}

export const DEFAULT_THRESHOLDS: SpeedThresholds = {
    minDownloadMbps: 8,
    minUploadMbps: 4,
    maxPingMs: 300,
};

const SPEED_TEST_PING_URL = import.meta.env.VITE_SPEED_TEST_PING_URL as string | undefined;
const SPEED_TEST_UPLOAD_URL = import.meta.env.VITE_SPEED_TEST_UPLOAD_URL as string | undefined;

async function measurePing(): Promise<number | null> {
    if (SPEED_TEST_PING_URL) {
        try {
            const start = performance.now();
            await fetch(SPEED_TEST_PING_URL, { cache: "no-cache" });
            return performance.now() - start;
        } catch {
            return null;
        }
    }
    const testUrls = [
        "https://www.google.com/favicon.ico",
        "https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js",
        "https://unpkg.com/react@18/umd/react.production.min.js",
    ];
    for (const url of testUrls) {
        try {
            const start = performance.now();
            await fetch(url, { mode: "no-cors", cache: "no-cache" });
            return performance.now() - start;
        } catch {
            continue;
        }
    }
    return null;
}

async function measureDownloadSpeed(): Promise<number | null> {
    const testUrls = [
        "https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css",
        "https://unpkg.com/react@18/umd/react.development.js",
        "https://cdn.jsdelivr.net/npm/jquery@3.6.0/dist/jquery.min.js",
    ];
    for (const url of testUrls) {
        try {
            const start = performance.now();
            const response = await fetch(url, { cache: "no-cache" });
            if (!response.ok) continue;
            const blob = await response.blob();
            if (blob.size === 0) continue;
            const seconds = (performance.now() - start) / 1000;
            if (seconds <= 0) continue;
            return blob.size / (1024 * 1024) / seconds;
        } catch {
            continue;
        }
    }
    // Nothing could be measured: report it as such instead of inventing a speed.
    return null;
}

async function measureUploadSpeed(): Promise<number | null> {
    const uploadSizeMB = 0.5;
    const uploadData = new Blob([new ArrayBuffer(uploadSizeMB * 1024 * 1024)], {
        type: "application/octet-stream",
    });
    const endpoints = SPEED_TEST_UPLOAD_URL
        ? [SPEED_TEST_UPLOAD_URL]
        : ["https://httpbin.org/post", "https://www.httpbin.org/post", "https://postman-echo.com/post"];
    for (const endpoint of endpoints) {
        try {
            const formData = new FormData();
            formData.append("test", uploadData);
            const start = performance.now();
            const response = await fetch(endpoint, { method: "POST", body: formData });
            if (!response.ok) continue;
            const seconds = (performance.now() - start) / 1000;
            if (seconds <= 0) continue;
            return uploadSizeMB / seconds;
        } catch {
            continue;
        }
    }
    return null;
}

async function runMultipleTests(testFn: () => Promise<number | null>, count = 3): Promise<number[]> {
    const results: number[] = [];
    for (let i = 0; i < count; i++) {
        try {
            const value = await testFn();
            if (value !== null) results.push(value);
            await new Promise((r) => setTimeout(r, 100));
        } catch {
            // skip failed test
        }
    }
    return results;
}

function average(values: number[]): number {
    if (values.length === 0) return 0;
    if (values.length <= 2) return values.reduce((a, b) => a + b, 0) / values.length;
    const sorted = [...values].sort((a, b) => a - b);
    const trimmed = sorted.slice(1, -1);
    return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
}

function classifyMin(tests: number[], value: number, min: number): CheckStatus {
    if (tests.length === 0) return "unmeasured";
    return value >= min ? "ok" : "slow";
}

function classifyMax(tests: number[], value: number, max: number): CheckStatus {
    if (tests.length === 0) return "unmeasured";
    return value <= max ? "ok" : "slow";
}

export async function testInternetSpeed(
    thresholds: SpeedThresholds = DEFAULT_THRESHOLDS
): Promise<InternetSpeedResult> {
    try {
        const [downloadTests, uploadTests, pingTests] = await Promise.all([
            runMultipleTests(measureDownloadSpeed, 3),
            runMultipleTests(measureUploadSpeed, 3),
            runMultipleTests(measurePing, 3),
        ]);

        const downloadMbps = average(downloadTests) * 8;
        const uploadMbps = average(uploadTests) * 8;
        const ping = average(pingTests);

        const checks = {
            download: classifyMin(downloadTests, downloadMbps, thresholds.minDownloadMbps),
            upload: classifyMin(uploadTests, uploadMbps, thresholds.minUploadMbps),
            ping: classifyMax(pingTests, ping, thresholds.maxPingMs),
        };
        const values = Object.values(checks);
        const status: ReadinessStatus = values.includes("unmeasured")
            ? "unmeasured"
            : values.includes("slow")
              ? "warn"
              : "pass";

        return {
            download: Math.round(downloadMbps * 100) / 100,
            upload: Math.round(uploadMbps * 100) / 100,
            // 999 is the existing "no measurement" sentinel for the ping field; `checks.ping` carries the truth.
            ping: pingTests.length === 0 ? 999 : Math.round(ping),
            passed: status === "pass",
            status,
            checks,
            downloadTests: downloadTests.map((v) => Math.round(v * 8 * 100) / 100),
            uploadTests: uploadTests.map((v) => Math.round(v * 8 * 100) / 100),
            pingTests: pingTests.map((v) => Math.round(v)),
        };
    } catch {
        return {
            download: 0,
            upload: 0,
            ping: 999,
            passed: false,
            status: "unmeasured",
            checks: { download: "unmeasured", upload: "unmeasured", ping: "unmeasured" },
            downloadTests: [],
            uploadTests: [],
            pingTests: [],
        };
    }
}
