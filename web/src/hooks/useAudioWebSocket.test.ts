// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useAudioWebSocket } from "./useAudioWebSocket";

vi.mock("@/services/api", () => ({ WS_URL: "ws://test" }));

class FakeWebSocket {
    static OPEN = 1;
    static instances: FakeWebSocket[] = [];
    readyState = 1;
    binaryType = "";
    onopen: (() => void) | null = null;
    onmessage: ((e: { data: unknown }) => void) | null = null;
    onerror: (() => void) | null = null;
    onclose: (() => void) | null = null;
    send = vi.fn();
    close = vi.fn();
    constructor(public url: string) {
        FakeWebSocket.instances.push(this);
    }
}

function setup() {
    const onStateChange = vi.fn();
    const onFatalError = vi.fn(); // BARU
    const { result } = renderHook(() =>
        useAudioWebSocket({
            sessionId: 1,
            token: "tok",
            onAudioChunk: vi.fn(),
            onTranscript: vi.fn(),
            onStateChange,
            onSpeakerChange: vi.fn(),
            onFatalError, // BARU
        })
    );
    act(() => result.current.connect());
    const ws = FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
    const receive = (msg: object) =>
        act(() => ws.onmessage?.({ data: JSON.stringify(msg) }));
    return { onStateChange, onFatalError, receive }; // onFatalError ditambah
}

describe("useAudioWebSocket: session_ended", () => {
    beforeEach(() => {
        FakeWebSocket.instances = [];
        vi.stubGlobal("WebSocket", FakeWebSocket);
    });
    afterEach(() => vi.unstubAllGlobals());

    it("reports 'failed' when the session ended with an error", () => {
        const { onStateChange, onFatalError, receive } = setup(); // onFatalError ditambah
        receive({ type: "session_ended", reason: "error" });
        expect(onStateChange).toHaveBeenCalledWith("failed");
        expect(onStateChange).not.toHaveBeenCalledWith("complete");
        expect(onFatalError).toHaveBeenCalledWith("session_error"); // BARU
    });

    it("reports 'complete' when the session ended normally", () => {
        const { onStateChange, onFatalError, receive } = setup(); // onFatalError ditambah
        receive({ type: "session_ended", reason: "completed" });
        expect(onStateChange).toHaveBeenCalledWith("complete");
        expect(onStateChange).not.toHaveBeenCalledWith("failed");
        expect(onFatalError).not.toHaveBeenCalled(); // BARU
    });
});