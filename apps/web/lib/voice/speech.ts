/**
 * Speech-to-text behind one small interface, so the same web code works everywhere:
 *
 *  1. Native bridge — native shells (Capacitor on Android/iOS, Tauri on desktop) can expose
 *     `window.PowerWeekNative.speech` backed by the OS recogniser or on-device Whisper.
 *  2. Web Speech API — Chrome, Edge and Safari in the browser. On desktop Chromium it listens to
 *     the microphone PowerWeek opens (the one picked in Settings, see `microphone.ts`).
 *
 * Without either, the Voice Dock falls back to typing.
 */

import {
  feedsTrackToSpeech,
  micErrorCode,
  openMicrophone,
  releaseMicrophone,
  userAgentData,
  type MicChoice,
  type OpenedMicrophone,
} from "./microphone";

export type SpeechErrorCode =
  /** Microphone permission denied. */
  | "not-allowed"
  /** No microphone connected, or it could not be opened. */
  | "no-microphone"
  /** The microphone is in use elsewhere or not responding. */
  | "busy"
  /** The microphone was unplugged while listening. */
  | "device-lost"
  /** Listened, heard no words. */
  | "no-speech"
  /** The browser's speech service could not be reached. */
  | "network"
  /** The browser refuses its speech service (Safari with macOS Dictation off, Brave…). */
  | "service"
  /** No speech recognition in this browser. */
  | "unsupported"
  | "other";

export interface SpeechCallbacks {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (code: SpeechErrorCode) => void;
  onEnd: () => void;
}

/** What a native shell returns from `start`. */
export interface NativeSpeechSession {
  /** Stop listening and deliver what was heard through onFinal. */
  stop: () => void;
  /** Stop listening and discard the transcript. */
  abort: () => void;
}

export interface SpeechSession extends NativeSpeechSession {
  /** The microphone PowerWeek opened, for level meters; null when the browser or shell listens. */
  stream: MediaStream | null;
  /** True when the chosen microphone was not connected and the system default listens instead. */
  fellBack: boolean;
}

/** Contract for native shells. Documented in docs/native-strategy.md. */
export interface NativeSpeechBridge {
  start(options: { lang: string }, callbacks: SpeechCallbacks): NativeSpeechSession;
}

export interface SpeechOptions {
  /** BCP 47 tag, e.g. "es-ES". */
  lang: string;
  /** The microphone picked in Settings; null or absent means the system default. */
  microphone?: MicChoice | null;
}

interface RecognitionResultList {
  length: number;
  [index: number]: { isFinal: boolean; 0: { transcript: string } };
}

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(audioTrack?: MediaStreamTrack): void;
  stop(): void;
  abort(): void;
  onresult: ((event: { resultIndex: number; results: RecognitionResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => Recognition;

declare global {
  interface Window {
    PowerWeekNative?: { speech?: NativeSpeechBridge };
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  }
}

/** After stop(), how long the recogniser gets to deliver its last words before we finish. */
export const STOP_GRACE_MS = 3000;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export function speechSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.PowerWeekNative?.speech || recognitionCtor());
}

export function mapRecognitionError(error: string): SpeechErrorCode {
  switch (error) {
    case "not-allowed":
      return "not-allowed";
    case "no-speech":
      return "no-speech";
    case "audio-capture":
      return "no-microphone";
    case "network":
      return "network";
    case "service-not-allowed":
    case "language-not-supported":
      return "service";
    default:
      return "other";
  }
}

/** Starts listening. Resolves to null, after reporting the reason through onError, if it can't. */
export async function startSpeech(
  options: SpeechOptions,
  callbacks: SpeechCallbacks,
): Promise<SpeechSession | null> {
  const native = typeof window !== "undefined" ? window.PowerWeekNative?.speech : undefined;
  if (native) {
    const session = native.start({ lang: options.lang }, callbacks);
    return { stop: session.stop, abort: session.abort, stream: null, fellBack: false };
  }

  const Ctor = recognitionCtor();
  if (!Ctor) {
    callbacks.onError("unsupported");
    return null;
  }

  let mic: OpenedMicrophone | null = null;
  if (feedsTrackToSpeech(userAgentData())) {
    try {
      mic = await openMicrophone(options.microphone ?? null);
    } catch (error) {
      callbacks.onError(micErrorCode(error));
      return null;
    }
  }
  let track = mic?.stream.getAudioTracks()[0];

  const recognition = new Ctor();
  recognition.lang = options.lang;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let finalText = "";
  let interimText = "";
  let discarded = false;
  let done = false;
  let grace: ReturnType<typeof setTimeout> | undefined;

  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(grace);
    track?.removeEventListener("ended", onTrackEnded);
    releaseMicrophone(mic?.stream);
    const text = `${finalText}${interimText}`.trim();
    if (!discarded && text) callbacks.onFinal(text);
    callbacks.onEnd();
  };
  const abort = () => {
    if (done) return;
    discarded = true;
    try {
      recognition.abort();
    } catch {}
    finish();
  };
  // An unplugged microphone ends its track, and the recogniser would wait for audio forever.
  function onTrackEnded() {
    if (done) return;
    callbacks.onError("device-lost");
    abort();
  }

  recognition.onresult = (event) => {
    interimText = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]!;
      const text = result[0].transcript;
      if (result.isFinal) finalText += text;
      else interimText += text;
    }
    callbacks.onPartial(`${finalText}${interimText}`.trim());
  };
  recognition.onerror = (event) => {
    if (event.error === "aborted") return;
    callbacks.onError(mapRecognitionError(event.error));
  };
  recognition.onend = finish;

  try {
    if (track) recognition.start(track);
    else recognition.start();
  } catch {
    releaseMicrophone(mic?.stream);
    if (!track) {
      callbacks.onError("other");
      return null;
    }
    // An engine that refuses the track can still listen to its own microphone.
    mic = null;
    track = undefined;
    try {
      recognition.start();
    } catch {
      callbacks.onError("other");
      return null;
    }
  }
  track?.addEventListener("ended", onTrackEnded);

  return {
    stop: () => {
      if (done) return;
      try {
        recognition.stop();
      } catch {}
      clearTimeout(grace);
      grace = setTimeout(finish, STOP_GRACE_MS);
    },
    abort,
    stream: mic?.stream ?? null,
    fellBack: mic?.fellBack ?? false,
  };
}
