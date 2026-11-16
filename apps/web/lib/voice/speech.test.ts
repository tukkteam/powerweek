import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mapRecognitionError, startSpeech, STOP_GRACE_MS, type SpeechCallbacks } from "./speech";

/* ---------- A tiny fake browser: speech recogniser, microphones, user agent ---------- */

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  static refuseTrack = false;
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  starts: unknown[][] = [];
  stopped = false;
  aborted = false;

  constructor() {
    FakeRecognition.instances.push(this);
  }
  start(...args: unknown[]) {
    if (FakeRecognition.refuseTrack && args.length) throw new TypeError("Unexpected argument");
    this.starts.push(args);
  }
  stop() {
    this.stopped = true;
  }
  abort() {
    this.aborted = true;
  }
  hear(transcript: string, isFinal: boolean) {
    this.onresult?.({ resultIndex: 0, results: { length: 1, 0: { isFinal, 0: { transcript } } } });
  }
  end() {
    this.onend?.();
  }
}

function fakeMicrophone(label: string) {
  const listeners = new Set<() => void>();
  const track = {
    kind: "audio",
    label,
    stop: vi.fn(),
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    unplug: () => listeners.forEach((listener) => listener()),
  };
  const stream = { getAudioTracks: () => [track], getTracks: () => [track] };
  return { track, stream: stream as unknown as MediaStream };
}

const chrome = {
  brands: [{ brand: "Chromium", version: "157" }],
  mobile: false,
  platform: "macOS",
};

const missing = () => Promise.reject(new DOMException("No such device", "OverconstrainedError"));

function stubBrowser({
  ua = chrome as object | null,
  getUserMedia = vi.fn<(constraints: MediaStreamConstraints) => Promise<MediaStream>>(() =>
    Promise.resolve(fakeMicrophone("Mic").stream),
  ),
  devices = [] as { kind: string; deviceId: string; label: string; groupId: string }[],
  recognition = true,
} = {}) {
  vi.stubGlobal("window", recognition ? { SpeechRecognition: FakeRecognition } : {});
  vi.stubGlobal("navigator", {
    userAgentData: ua,
    mediaDevices: { getUserMedia, enumerateDevices: () => Promise.resolve(devices) },
  });
  return getUserMedia;
}

function callbacks() {
  return {
    onPartial: vi.fn(),
    onFinal: vi.fn(),
    onError: vi.fn(),
    onEnd: vi.fn(),
  } satisfies SpeechCallbacks;
}

const exactId = (call: unknown[] | undefined) =>
  ((call?.[0] as MediaStreamConstraints).audio as MediaTrackConstraints).deviceId;

beforeEach(() => {
  FakeRecognition.instances = [];
  FakeRecognition.refuseTrack = false;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const lastRecognition = () => FakeRecognition.instances.at(-1)!;

/* ---------- Tests ---------- */

describe("startSpeech on desktop Chromium", () => {
  it("listens to the system default through Chromium's alias, not a remembered device", async () => {
    const mic = fakeMicrophone("MacBook Pro Microphone");
    const getUserMedia = stubBrowser({ getUserMedia: vi.fn(() => Promise.resolve(mic.stream)) });
    const session = await startSpeech({ lang: "es-ES" }, callbacks());

    expect(exactId(getUserMedia.mock.calls[0])).toEqual({ exact: "default" });
    expect(lastRecognition().starts).toEqual([[mic.track]]);
    expect(lastRecognition().lang).toBe("es-ES");
    expect(session?.stream).toBe(mic.stream);
    expect(session?.fellBack).toBe(false);
  });

  it("opens the microphone picked in Settings", async () => {
    const getUserMedia = stubBrowser();
    const session = await startSpeech(
      { lang: "es-ES", microphone: { id: "scarlett", label: "Scarlett 2i2" } },
      callbacks(),
    );
    expect(exactId(getUserMedia.mock.calls[0])).toEqual({ exact: "scarlett" });
    expect(session?.fellBack).toBe(false);
  });

  it("falls back to the system default when the picked microphone is unplugged", async () => {
    const builtIn = fakeMicrophone("MacBook Pro Microphone");
    const getUserMedia = stubBrowser({
      getUserMedia: vi.fn((constraints: MediaStreamConstraints) =>
        (constraints.audio as MediaTrackConstraints).deviceId &&
        JSON.stringify((constraints.audio as MediaTrackConstraints).deviceId).includes("scarlett")
          ? missing()
          : Promise.resolve(builtIn.stream),
      ),
      devices: [
        { kind: "audioinput", deviceId: "m1", label: "MacBook Pro Microphone", groupId: "g" },
      ],
    });
    const session = await startSpeech(
      { lang: "es-ES", microphone: { id: "scarlett", label: "Scarlett 2i2" } },
      callbacks(),
    );
    expect(getUserMedia.mock.calls.map(exactId)).toEqual([
      { exact: "scarlett" },
      { exact: "default" },
    ]);
    expect(session?.fellBack).toBe(true);
    expect(lastRecognition().starts).toEqual([[builtIn.track]]);
  });

  it("finds the picked microphone by name when its id changed", async () => {
    const getUserMedia = stubBrowser({
      getUserMedia: vi.fn((constraints: MediaStreamConstraints) =>
        JSON.stringify(constraints).includes("old-id")
          ? missing()
          : Promise.resolve(fakeMicrophone("Scarlett 2i2").stream),
      ),
      devices: [{ kind: "audioinput", deviceId: "new-id", label: "Scarlett 2i2", groupId: "g" }],
    });
    const session = await startSpeech(
      { lang: "es-ES", microphone: { id: "old-id", label: "Scarlett 2i2" } },
      callbacks(),
    );
    expect(getUserMedia.mock.calls.map(exactId)).toEqual([
      { exact: "old-id" },
      { exact: "new-id" },
    ]);
    expect(session?.fellBack).toBe(false);
  });

  it("reports a denied permission without starting", async () => {
    stubBrowser({
      getUserMedia: vi.fn(() => Promise.reject(new DOMException("Denied", "NotAllowedError"))),
    });
    const cb = callbacks();
    expect(await startSpeech({ lang: "es-ES" }, cb)).toBeNull();
    expect(cb.onError).toHaveBeenCalledWith("not-allowed");
    expect(FakeRecognition.instances).toHaveLength(0);
  });

  it("reports a busy microphone", async () => {
    stubBrowser({
      getUserMedia: vi.fn(() => Promise.reject(new DOMException("In use", "NotReadableError"))),
    });
    const cb = callbacks();
    expect(await startSpeech({ lang: "es-ES" }, cb)).toBeNull();
    expect(cb.onError).toHaveBeenCalledWith("busy");
  });

  it("delivers what it heard and releases the microphone when the recogniser ends", async () => {
    const mic = fakeMicrophone("Mic");
    stubBrowser({ getUserMedia: vi.fn(() => Promise.resolve(mic.stream)) });
    const cb = callbacks();
    const session = await startSpeech({ lang: "es-ES" }, cb);

    lastRecognition().hear("hoy ceno", false);
    expect(cb.onPartial).toHaveBeenLastCalledWith("hoy ceno");
    lastRecognition().hear("hoy ceno sushi", true);
    session!.stop();
    expect(lastRecognition().stopped).toBe(true);
    lastRecognition().end();

    expect(cb.onFinal).toHaveBeenCalledWith("hoy ceno sushi");
    expect(cb.onEnd).toHaveBeenCalledTimes(1);
    expect(mic.track.stop).toHaveBeenCalled();
  });

  it("finishes by itself if the recogniser never ends after stop", async () => {
    vi.useFakeTimers();
    const mic = fakeMicrophone("Mic");
    stubBrowser({ getUserMedia: vi.fn(() => Promise.resolve(mic.stream)) });
    const cb = callbacks();
    const session = await startSpeech({ lang: "es-ES" }, cb);
    lastRecognition().hear("quita la cena", false);
    session!.stop();

    vi.advanceTimersByTime(STOP_GRACE_MS - 1);
    expect(cb.onEnd).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(cb.onFinal).toHaveBeenCalledWith("quita la cena");
    expect(cb.onEnd).toHaveBeenCalledTimes(1);
    expect(mic.track.stop).toHaveBeenCalled();

    lastRecognition().end(); // a late end changes nothing
    expect(cb.onEnd).toHaveBeenCalledTimes(1);
  });

  it("stops at once, sending nothing, when the microphone is unplugged mid-sentence", async () => {
    const mic = fakeMicrophone("Scarlett 2i2");
    stubBrowser({ getUserMedia: vi.fn(() => Promise.resolve(mic.stream)) });
    const cb = callbacks();
    await startSpeech({ lang: "es-ES" }, cb);
    lastRecognition().hear("mañana entreno", false);

    mic.track.unplug();

    expect(cb.onError).toHaveBeenCalledWith("device-lost");
    expect(lastRecognition().aborted).toBe(true);
    expect(cb.onFinal).not.toHaveBeenCalled();
    expect(cb.onEnd).toHaveBeenCalledTimes(1);
    lastRecognition().end();
    expect(cb.onEnd).toHaveBeenCalledTimes(1);
  });

  it("discards the transcript on abort", async () => {
    stubBrowser();
    const cb = callbacks();
    const session = await startSpeech({ lang: "es-ES" }, cb);
    lastRecognition().hear("hola", true);
    session!.abort();
    expect(cb.onFinal).not.toHaveBeenCalled();
    expect(cb.onEnd).toHaveBeenCalledTimes(1);
  });

  it("passes recogniser errors on, then ends", async () => {
    stubBrowser();
    const cb = callbacks();
    await startSpeech({ lang: "es-ES" }, cb);
    lastRecognition().onerror?.({ error: "no-speech" });
    lastRecognition().onerror?.({ error: "aborted" });
    lastRecognition().end();
    expect(cb.onError.mock.calls).toEqual([["no-speech"]]);
    expect(cb.onEnd).toHaveBeenCalledTimes(1);
  });

  it("lets an engine that refuses the track listen on its own", async () => {
    FakeRecognition.refuseTrack = true;
    const mic = fakeMicrophone("Mic");
    stubBrowser({ getUserMedia: vi.fn(() => Promise.resolve(mic.stream)) });
    const session = await startSpeech({ lang: "es-ES" }, callbacks());
    expect(lastRecognition().starts).toEqual([[]]);
    expect(mic.track.stop).toHaveBeenCalled();
    expect(session?.stream).toBeNull();
  });
});

describe("startSpeech elsewhere", () => {
  it("leaves the microphone to browsers that ignore tracks (Safari, phones)", async () => {
    const getUserMedia = stubBrowser({ ua: null });
    const session = await startSpeech(
      { lang: "en-US", microphone: { id: "scarlett", label: "Scarlett 2i2" } },
      callbacks(),
    );
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(lastRecognition().starts).toEqual([[]]);
    expect(session?.stream).toBeNull();
  });

  it("reports browsers without speech recognition", async () => {
    stubBrowser({ recognition: false });
    const cb = callbacks();
    expect(await startSpeech({ lang: "es-ES" }, cb)).toBeNull();
    expect(cb.onError).toHaveBeenCalledWith("unsupported");
  });
});

describe("mapRecognitionError", () => {
  it("turns Web Speech errors into what the user can do about them", () => {
    expect(mapRecognitionError("not-allowed")).toBe("not-allowed");
    expect(mapRecognitionError("no-speech")).toBe("no-speech");
    expect(mapRecognitionError("audio-capture")).toBe("no-microphone");
    expect(mapRecognitionError("network")).toBe("network");
    expect(mapRecognitionError("service-not-allowed")).toBe("service");
    expect(mapRecognitionError("language-not-supported")).toBe("service");
    expect(mapRecognitionError("bad-grammar")).toBe("other");
  });
});
